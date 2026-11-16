import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, Clock3, Dumbbell, Footprints, Heart, Plus, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { auth, authConfigured } from './auth'

type SessionKind = 'Run' | 'Padel' | 'Gym' | 'Fencing' | 'Rehab' | 'Other'
type Session = { id: string; date: string; kind: SessionKind; title: string; duration?: number; effort?: number; distance?: number; sets?: number; reps?: number; completed?: boolean; pain?: number; notes?: string }
type RehabExercise = { id: string; name: string; detail: string }
type Diary = { sessions: Session[]; exercises: RehabExercise[] }

const KEY = 'stride-diary-v1'
const kinds: SessionKind[] = ['Run', 'Padel', 'Gym', 'Fencing', 'Rehab', 'Other']
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const emptyDiary: Diary = { sessions: [], exercises: [] }

function readDiary(): Diary {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyDiary
    const data = JSON.parse(raw) as Partial<Diary>
    return { sessions: Array.isArray(data.sessions) ? data.sessions : [], exercises: Array.isArray(data.exercises) ? data.exercises : [] }
  } catch { return emptyDiary }
}
function niceDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en', options).format(new Date(`${date}T12:00:00`))
}
function App() {
  const [authState, setAuthState] = useState<'loading' | 'signed-in' | 'signed-out' | 'error'>(authConfigured ? 'loading' : 'error')
  const [diary, setDiary] = useState<Diary>(readDiary)
  const [tab, setTab] = useState<'Overview' | 'History' | 'Rehab'>('Overview')
  const [modal, setModal] = useState(false)
  const [kind, setKind] = useState<SessionKind>('Run')
  const [exercise, setExercise] = useState('')
  const [customExercise, setCustomExercise] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!auth) return
    const manager = auth
    let active = true
    const callback = window.location.pathname === '/auth/callback'
    const finish = async () => {
      try {
        if (callback) {
          await manager.signinRedirectCallback()
          window.history.replaceState({}, document.title, '/')
        }
        const user = await manager.getUser()
        if (active) setAuthState(user && !user.expired ? 'signed-in' : 'signed-out')
      } catch {
        if (active) setAuthState('signed-out')
      }
    }
    void finish()
    return () => { active = false }
  }, [])

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(diary)) }, [diary])
  const sorted = useMemo(() => [...diary.sessions].sort((a, b) => b.date.localeCompare(a.date)), [diary.sessions])
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0)
  const thisWeek = diary.sessions.filter(s => new Date(`${s.date}T12:00:00`) >= weekStart)
  const weekMinutes = thisWeek.reduce((sum, s) => sum + (s.duration ?? 0), 0)
  const daysThisWeek = new Set(thisWeek.map(s => s.date)).size
  const recent = sorted.slice(0, 4)
  const update = (next: Diary) => setDiary(next)

  function addSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String((kind === 'Rehab' ? exercise : '') || kind)
    const session: Session = {
      id: crypto.randomUUID(), date: String(form.get('date') || today()), kind, title,
      duration: Number(form.get('duration')) || undefined, effort: Number(form.get('effort')) || undefined,
      distance: Number(form.get('distance')) || undefined, pain: Number(form.get('pain')) || undefined,
      sets: Number(form.get('sets')) || undefined, reps: Number(form.get('reps')) || undefined,
      notes: String(form.get('notes') || '').trim(), completed: true,
    }
    update({ ...diary, sessions: [session, ...diary.sessions] }); setModal(false)
  }
  function downloadBackup() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...diary }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `stride-backup-${today()}.json`; link.click(); URL.revokeObjectURL(link.href)
  }
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return
    try {
      const value = JSON.parse(await file.text()) as Partial<Diary>
      if (!Array.isArray(value.sessions) || !Array.isArray(value.exercises)) throw new Error('That file does not look like a Stride backup.')
      update({ sessions: value.sessions as Session[], exercises: value.exercises as RehabExercise[] }); setImportMessage('Backup restored.')
    } catch (error) { setImportMessage(error instanceof Error ? error.message : 'Could not read that backup.') }
    event.target.value = ''
  }
  function addExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = customExercise.trim(); if (!name) return
    update({ ...diary, exercises: [...diary.exercises, { id: crypto.randomUUID(), name, detail: 'As prescribed' }] }); setCustomExercise('')
  }
  function deleteSession(id: string) { update({ ...diary, sessions: diary.sessions.filter(s => s.id !== id) }) }

  if (authState !== 'signed-in') return <div className="auth-screen"><section className="auth-card"><span className="brand-mark"><Activity size={21}/></span><div className="eyebrow">YOUR PRIVATE TRAINING DIARY</div><h1>Stride<span className="accent">.</span></h1>{authState === 'loading' ? <p>Checking your sign-in…</p> : authState === 'error' ? <><p>Sign-in is not configured for this build.</p><small>Set the Cognito frontend build variables and rebuild.</small></> : <><p>Sign in to open your diary on this device.</p><button className="button primary" onClick={() => void auth?.signinRedirect({ extraQueryParams: { identity_provider: 'Google' } })}>Sign in with Google</button></> }<small>Your diary stays in this browser. Sign-in does not sync or back up entries.</small></section></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="Stride home"><span className="brand-mark"><Activity size={20}/></span><span>stride<span className="brand-dot">.</span></span></a>
      <div className="side-label">YOUR SPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {(['Overview', 'History', 'Rehab'] as const).map((item, index) => <button key={item} className={tab === item ? 'nav-item active' : 'nav-item'} onClick={() => setTab(item)}>{index === 0 ? <Activity/> : index === 1 ? <CalendarDays/> : <Heart/>}<span>{item}</span></button>)}
      </nav>
      <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={18}/><div><b>Your data stays yours</b><p>Saved privately on this device.</p></div></div><div className="version">STRIDE DIARY <span>·</span> 0.1</div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Activity size={19}/></span><b>stride<span className="brand-dot">.</span></b></div><div className="topbar-note"><span className="online-dot"/> Offline ready</div><button className="button subtle signout" onClick={() => void auth?.signoutRedirect()}>Sign out</button><button className="button primary top-add" onClick={() => setModal(true)}><Plus size={17}/> Log session</button></header>
      <div className="content">
        {tab === 'Overview' && <>
          <div className="greeting"><div><div className="eyebrow">{niceDate(today(), { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</div><h1>Good to see you<span className="accent">.</span></h1><p>Every step counts. Keep showing up for yourself.</p></div><div className="sun-stamp">✳</div></div>
          <section className="stat-grid" aria-label="This week's activity">
            <div className="stat-card"><div className="stat-top"><span className="stat-icon mint"><CalendarDays size={18}/></span><span className="stat-caption">THIS WEEK</span></div><div className="stat-number">{daysThisWeek}<span className="stat-unit"> days</span></div><div className="stat-foot">Days you moved</div></div>
            <div className="stat-card"><div className="stat-top"><span className="stat-icon peach"><Clock3 size={18}/></span><span className="stat-caption">THIS WEEK</span></div><div className="stat-number">{weekMinutes}<span className="stat-unit"> min</span></div><div className="stat-foot">Time well spent</div></div>
            <div className="stat-card stat-card-wide"><div className="stat-top"><span className="stat-icon lavender"><Heart size={18}/></span><span className="stat-caption">A GENTLE REMINDER</span></div><div className="recovery-note">Recovery is training, too.</div><div className="stat-foot">Follow the plan your physio gave you.</div></div>
          </section>
          <section className="section-head"><div><div className="eyebrow">YOUR JOURNEY</div><h2>Recent sessions</h2></div><button className="text-button" onClick={() => setTab('History')}>See all <span>↗</span></button></section>
          {recent.length ? <div className="session-list">{recent.map(s => <SessionRow key={s.id} session={s} onDelete={deleteSession}/>)}</div> : <EmptySessions onAdd={() => setModal(true)}/>}
          <section className="bottom-grid"><div className="prompt-card"><span className="prompt-icon"><Sparkles size={20}/></span><div><h3>Make space for recovery</h3><p>Log your physio exercises alongside everything else you do. It all belongs here.</p><button className="text-button dark" onClick={() => { setKind('Rehab'); setModal(true) }}>Log rehab <span>→</span></button></div><div className="prompt-flower">✳</div></div><div className="quick-card"><div className="eyebrow">QUICK ADD</div><h3>What did you do?</h3><div className="quick-actions">{[['Run', Footprints], ['Gym', Dumbbell], ['Rehab', Heart]] .map(([label, Icon]) => <button key={label as string} onClick={() => { setKind(label as SessionKind); setModal(true) }}><Icon size={16}/>{label as string}<Plus size={14}/></button>)}</div></div></section>
        </>}
        {tab === 'History' && <><div className="page-heading"><div className="eyebrow">YOUR JOURNEY</div><h1>Training history<span className="accent">.</span></h1><p>Every session, in one place.</p></div><div className="history-toolbar"><span>{diary.sessions.length} {diary.sessions.length === 1 ? 'session' : 'sessions'}</span><button className="button primary" onClick={() => setModal(true)}><Plus size={17}/> Log session</button></div>{sorted.length ? <div className="session-list">{sorted.map(s => <SessionRow key={s.id} session={s} onDelete={deleteSession}/>)}</div> : <EmptySessions onAdd={() => setModal(true)}/>}</>}
        {tab === 'Rehab' && <><div className="page-heading"><div className="eyebrow">GENTLE PROGRESS</div><h1>Rehab routine<span className="accent">.</span></h1><p>Add the exercises from your physiotherapist’s plan, then log what you complete and how it felt.</p></div><div className="rehab-callout"><Heart size={19}/><span>This diary helps you track your plan; your physiotherapist guides your recovery.</span></div>{diary.exercises.length > 0 && <div className="rehab-list">{diary.exercises.map(ex => <div className="rehab-row" key={ex.id}><span className="rehab-check"><Check size={17}/></span><div className="rehab-name"><b>{ex.name}</b><span>{ex.detail}</span></div><button className="button soft" onClick={() => { setKind('Rehab'); setExercise(ex.name); setModal(true) }}><Plus size={16}/> Log</button></div>)}</div>}<form className="add-exercise" onSubmit={addExercise}><label htmlFor="exercise-name">Add an exercise from your plan</label><div className="inline-form"><input id="exercise-name" value={customExercise} onChange={e => setCustomExercise(e.target.value)} placeholder="Exercise name"/><button className="button dark-button" type="submit"><Plus size={16}/> Add</button></div></form><section className="section-head rehab-logs-head"><div><div className="eyebrow">YOUR LOG</div><h2>Recent rehab sessions</h2></div></section>{sorted.filter(s => s.kind === 'Rehab').length ? <div className="session-list">{sorted.filter(s => s.kind === 'Rehab').slice(0, 8).map(s => <SessionRow key={s.id} session={s} onDelete={deleteSession}/>)}</div> : <div className="empty-compact">No rehab sessions logged yet.</div>}</>}
        <footer className="footer"><span>Made for the long game.</span><div className="footer-actions"><button onClick={downloadBackup}><ArrowDownToLine size={14}/> Export backup</button><button onClick={() => fileRef.current?.click()}><ArrowUpFromLine size={14}/> Import</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={importBackup}/></div></footer>
        {importMessage && <div className="toast" role="status">{importMessage}<button onClick={() => setImportMessage('')} aria-label="Dismiss"><X size={16}/></button></div>}
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">{(['Overview', 'History', 'Rehab'] as const).map((item, i) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{i === 0 ? <Activity/> : i === 1 ? <CalendarDays/> : <Heart/>}<span>{item}</span></button>)}</nav>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><div className="eyebrow">ADD TO YOUR JOURNEY</div><h2 id="modal-title">Log a session</h2></div><button className="icon-button" onClick={() => setModal(false)} aria-label="Close"><X size={20}/></button></div><form onSubmit={addSession} className="session-form"><label>Activity<select value={kind} onChange={e => setKind(e.target.value as SessionKind)}>{kinds.map(k => <option key={k}>{k}</option>)}</select></label>{kind === 'Rehab' && <label>Exercise<select value={exercise} onChange={e => setExercise(e.target.value)}><option value="">Choose an exercise</option>{diary.exercises.map(ex => <option key={ex.id} value={ex.name}>{ex.name}</option>)}</select></label>}<div className="form-grid"><label>Date<input name="date" type="date" defaultValue={today()} required/></label><label>Duration <small>minutes</small><input name="duration" type="number" min="1" placeholder="45"/></label></div>{kind === 'Run' && <label>Distance <small>km</small><input name="distance" type="number" min="0" step="0.1" placeholder="5.0"/></label>}{kind === 'Rehab' && <div className="form-grid"><label>Sets <small>optional</small><input name="sets" type="number" min="1" placeholder="3"/></label><label>Reps / holds <small>optional</small><input name="reps" type="number" min="1" placeholder="10"/></label></div>}<div className="form-grid"><label>Effort <small>1–10, optional</small><input name="effort" type="number" min="1" max="10" placeholder="Easy to hard"/></label><label>Discomfort <small>0–10, optional</small><input name="pain" type="number" min="0" max="10" placeholder="0"/></label></div><label>Notes<textarea name="notes" rows={3} placeholder="How did it feel? Anything you want to remember…"/></label><div className="modal-foot"><span><ShieldCheck size={15}/> Saved only on this device</span><button type="submit" className="button primary"><Check size={17}/> Save session</button></div></form></section></div>}
  </div>
}

function SessionRow({ session: s, onDelete }: { session: Session; onDelete: (id: string) => void }) {
  const Icon = s.kind === 'Run' ? Footprints : s.kind === 'Gym' ? Dumbbell : s.kind === 'Rehab' ? Heart : s.kind === 'Padel' ? Activity : s.kind === 'Fencing' ? Activity : Sparkles
  return <article className="session-row"><span className={`session-icon ${s.kind.toLowerCase()}`}><Icon size={18}/></span><div className="session-main"><b>{s.title}</b><span>{niceDate(s.date)} <i>·</i> {s.kind}{s.duration ? ` · ${s.duration} min` : ''}{s.distance ? ` · ${s.distance} km` : ''}{s.sets ? ` · ${s.sets} sets${s.reps ? ` × ${s.reps}` : ''}` : ''}</span>{s.notes && <p>{s.notes}</p>}</div><div className="session-meta">{s.effort && <span className="effort-pill">Effort {s.effort}/10</span>}{s.pain !== undefined && <span className="pain-label"><Heart size={13}/> {s.pain}/10</span>}<button className="delete-button" onClick={() => onDelete(s.id)} aria-label={`Delete ${s.title}`}><Trash2 size={15}/></button></div></article>
}
function EmptySessions({ onAdd }: { onAdd: () => void }) { return <div className="empty-state"><div className="empty-art"><Footprints size={31}/><span>✳</span></div><h3>Your first entry starts here</h3><p>Log a workout, a walk, or your physio exercises. Small steps count.</p><button className="button primary" onClick={onAdd}><Plus size={17}/> Log your first session</button></div> }

export default App
