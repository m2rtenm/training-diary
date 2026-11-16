export type SessionKind = 'Run' | 'Padel' | 'Gym' | 'Fencing' | 'Rehab' | 'Other'
export type Session = {
  id: string
  date: string
  kind: SessionKind
  title: string
  duration?: number
  effort?: number
  distance?: number
  sets?: number
  reps?: number
  completed?: boolean
  pain?: number
  notes?: string
}
export type RehabExercise = { id: string; name: string; detail: string }
export type Diary = { sessions: Session[]; exercises: RehabExercise[] }

export const MAX_DIARY_BYTES = 2 * 1024 * 1024
const SESSION_KINDS = new Set<SessionKind>(['Run', 'Padel', 'Gym', 'Fencing', 'Rehab', 'Other'])
const LIMITS: Record<string, [number, number]> = {
  duration: [1, 1440], effort: [1, 10], distance: [0, 1000], sets: [1, 10000], reps: [1, 10000], pain: [0, 10],
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const boundedText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const optionalNumber = (value: unknown, min: number, max: number) => value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max)
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateDiary(value: unknown): Diary | null {
  if (!record(value) || !Array.isArray(value.sessions) || !Array.isArray(value.exercises)) return null
  if (value.sessions.length > 5000 || value.exercises.length > 200) return null

  const sessions: Session[] = []
  for (const entry of value.sessions) {
    if (!record(entry) || !boundedText(entry.id, 100) || !validDate(entry.date) ||
      typeof entry.kind !== 'string' || !SESSION_KINDS.has(entry.kind as SessionKind) ||
      !boundedText(entry.title, 120) || !optionalNumber(entry.duration, ...LIMITS.duration) ||
      !optionalNumber(entry.effort, ...LIMITS.effort) || !optionalNumber(entry.distance, ...LIMITS.distance) ||
      !optionalNumber(entry.sets, ...LIMITS.sets) || !optionalNumber(entry.reps, ...LIMITS.reps) ||
      !optionalNumber(entry.pain, ...LIMITS.pain) || (entry.completed !== undefined && typeof entry.completed !== 'boolean') ||
      (entry.notes !== undefined && (typeof entry.notes !== 'string' || entry.notes.length > 4000))) return null

    sessions.push({
      id: entry.id,
      date: entry.date,
      kind: entry.kind as SessionKind,
      title: entry.title,
      ...(entry.duration !== undefined ? { duration: entry.duration as number } : {}),
      ...(entry.effort !== undefined ? { effort: entry.effort as number } : {}),
      ...(entry.distance !== undefined ? { distance: entry.distance as number } : {}),
      ...(entry.sets !== undefined ? { sets: entry.sets as number } : {}),
      ...(entry.reps !== undefined ? { reps: entry.reps as number } : {}),
      ...(entry.completed !== undefined ? { completed: entry.completed } : {}),
      ...(entry.pain !== undefined ? { pain: entry.pain as number } : {}),
      ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
    })
  }

  const exercises: RehabExercise[] = []
  for (const entry of value.exercises) {
    if (!record(entry) || !boundedText(entry.id, 100) || !boundedText(entry.name, 120) ||
      typeof entry.detail !== 'string' || entry.detail.length > 500) return null
    exercises.push({ id: entry.id, name: entry.name, detail: entry.detail })
  }

  return { sessions, exercises }
}
