import { validateDiary, type Diary } from './diaryValidation'

const SYNC_KEY = 'stride-sync-v1'
const MAX_ATTEMPTS = 3

type SyncBase = { revision: number; diary: Diary }
type RemoteDiary = { revision: number; diary: Diary | null }

function equal(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function localBase(): SyncBase | null {
  try {
    const value = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') as Partial<SyncBase> | null
    if (!value || !Number.isSafeInteger(value.revision) || (value.revision ?? -1) < 0) return null
    const diary = validateDiary(value.diary)
    return diary ? { revision: value.revision!, diary } : null
  } catch { return null }
}

function saveBase(base: SyncBase) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(base))
}

function mergeById<T extends { id: string }>(base: T[], local: T[], remote: T[]): T[] {
  const before = new Map(base.map(item => [item.id, item]))
  const localMap = new Map(local.map(item => [item.id, item]))
  const remoteMap = new Map(remote.map(item => [item.id, item]))
  const ids = new Set([...before.keys(), ...localMap.keys(), ...remoteMap.keys()])
  const merged: T[] = []
  for (const id of ids) {
    const original = before.get(id)
    const localItem = localMap.get(id)
    const remoteItem = remoteMap.get(id)
    const localChanged = !equal(localItem, original)
    const result = localChanged ? localItem : remoteItem
    if (result) merged.push(result)
  }
  return merged
}

function reconcile(local: Diary, remote: Diary, base: Diary | null): Diary {
  if (!base) {
    // Legacy browser-only data may be present on the first syncing device.
    return {
      sessions: mergeById([], local.sessions, remote.sessions),
      exercises: mergeById([], local.exercises, remote.exercises),
    }
  }
  return {
    sessions: mergeById(base.sessions, local.sessions, remote.sessions),
    exercises: mergeById(base.exercises, local.exercises, remote.exercises),
  }
}

async function request<T>(method: 'GET' | 'PUT', token: string, body?: unknown): Promise<T> {
  let apiUrl: URL
  try { apiUrl = new URL(__STRIDE_API_URL__) }
  catch { throw new Error('Diary sync is not configured with a trusted HTTPS API.') }
  if (apiUrl.protocol !== 'https:' || !/^[a-z0-9-]+\.lambda-url\.[a-z0-9-]+\.on\.aws$/i.test(apiUrl.hostname)) {
    throw new Error('Diary sync is not configured with a trusted HTTPS API.')
  }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(apiUrl, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      signal: controller.signal,
    })
    if (response.status === 409) throw new Error('CONFLICT')
    if (!response.ok) {
      const message = (await response.json().catch(() => null))?.error
      throw new Error(typeof message === 'string' ? message : `Diary sync failed (${response.status}).`)
    }
    return response.status === 204 ? undefined as T : await response.json() as T
  } finally { window.clearTimeout(timer) }
}

export async function syncDiary(local: Diary, accessToken: string): Promise<Diary> {
  const previous = localBase()
  let candidate = local

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remoteState = await request<RemoteDiary>('GET', accessToken)
    if (!Number.isSafeInteger(remoteState.revision) || remoteState.revision < 0) throw new Error('Cloud diary returned an invalid revision.')
    const remote = remoteState.diary === null ? { sessions: [], exercises: [] } : validateDiary(remoteState.diary)
    if (!remote) throw new Error('Cloud diary data is invalid; local data has been preserved.')

    candidate = reconcile(candidate, remote, previous?.diary ?? null)
    if (equal(candidate, remote)) {
      saveBase({ revision: remoteState.revision, diary: remote })
      return remote
    }

    try {
      const saved = await request<{ revision: number }>('PUT', accessToken, {
        expectedRevision: remoteState.revision,
        diary: candidate,
      })
      if (!Number.isSafeInteger(saved.revision) || saved.revision !== remoteState.revision + 1) throw new Error('Cloud diary returned an invalid revision.')
      saveBase({ revision: saved.revision, diary: candidate })
      return candidate
    } catch (error) {
      if (error instanceof Error && error.message === 'CONFLICT') continue
      throw error
    }
  }
  throw new Error('Diary changed on another device. Your local changes are saved; retry sync shortly.')
}
