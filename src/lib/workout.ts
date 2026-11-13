import { useApp } from '../store/app'
import { EX_BY_ID } from '../data/exercises'
import { PROGRAM_BY_ID } from '../data/programs'
import type { ActiveWorkout, LoggedExercise, PlanItem, WorkoutSession } from '../types'
import { epley, uid } from './util'
import { cloud } from './cloud'

/** Last weight used for an exercise, for smart pre-fill */
export function lastKg(exId: string): number {
  for (const s of useApp.getState().sessions) {
    const ex = s.exercises.find((e) => e.exId === exId)
    const done = ex?.sets.filter((x) => x.done && x.kg > 0)
    if (done && done.length) return done[done.length - 1].kg
  }
  return 0
}

export function startWorkout(name: string, items: PlanItem[], programId?: string, dayIndex?: number) {
  const log: LoggedExercise[] = items.map((it) => ({
    exId: it.exId,
    sets: Array.from({ length: it.sets }, () => ({ reps: it.reps ?? 0, secs: it.secs, kg: lastKg(it.exId), done: false })),
  }))
  const active: ActiveWorkout = { name, programId, dayIndex, startedAt: new Date().toISOString(), items, log, current: 0 }
  useApp.setState({ active })
}

export type PRecord = { exId: string; kind: 'weight' | 'reps' | 'time'; value: number; kg?: number; reps?: number; date: string }

/** Personal records across all sessions (derived — no extra table needed). */
export function computeRecords(sessions: WorkoutSession[]): PRecord[] {
  const best = new Map<string, PRecord>()
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const s of ordered) {
    for (const ex of s.exercises) {
      const meta = EX_BY_ID[ex.exId]
      if (!meta) continue
      for (const set of ex.sets) {
        if (!set.done) continue
        let rec: PRecord | null = null
        if (meta.tracking === 'time') rec = { exId: ex.exId, kind: 'time', value: set.secs ?? 0, date: s.startedAt }
        else if (set.kg > 0) rec = { exId: ex.exId, kind: 'weight', value: epley(set.kg, set.reps), kg: set.kg, reps: set.reps, date: s.startedAt }
        else rec = { exId: ex.exId, kind: 'reps', value: set.reps, reps: set.reps, date: s.startedAt }
        const cur = best.get(ex.exId)
        // a weighted record always beats a bodyweight one for the same exercise
        const better = !cur || (rec.kind === 'weight' && cur.kind !== 'weight') || (rec.kind === cur.kind && rec.value > cur.value)
        if (better && rec.value > 0) best.set(ex.exId, rec)
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export function finishWorkout(): { session: WorkoutSession; newPRs: PRecord[] } | null {
  const st = useApp.getState()
  const a = st.active
  if (!a) return null
  const before = new Map(computeRecords(st.sessions).map((r) => [r.exId, r]))
  const exercises = a.log.map((l) => ({ exId: l.exId, sets: l.sets.filter((s) => s.done) })).filter((l) => l.sets.length)
  const volumeKg = exercises.reduce((v, e) => v + e.sets.reduce((x, s) => x + s.kg * s.reps, 0), 0)
  const session: WorkoutSession = {
    id: uid(),
    name: a.name,
    programId: a.programId,
    dayIndex: a.dayIndex,
    startedAt: a.startedAt,
    durationSec: Math.round((Date.now() - new Date(a.startedAt).getTime()) / 1000),
    volumeKg: Math.round(volumeKg),
    exercises,
    source: 'player',
  }
  const programDay = { ...st.programDay }
  if (a.programId && a.dayIndex !== undefined) {
    const p = PROGRAM_BY_ID[a.programId]
    if (p) programDay[a.programId] = (a.dayIndex + 1) % p.days.length
  }
  useApp.setState({ sessions: [session, ...st.sessions], active: null, programDay })
  void cloud.session(session)
  const after = computeRecords([session, ...st.sessions])
  const newPRs = after.filter((r) => {
    const b = before.get(r.exId)
    return r.date === session.startedAt && (!b || r.value > b.value || (r.kind === 'weight' && b.kind !== 'weight'))
  })
  return { session, newPRs }
}
