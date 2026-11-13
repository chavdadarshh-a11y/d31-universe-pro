import { useApp } from '../store/app'
import { exOf } from '../data/exercises'
import { PROGRAM_BY_ID } from '../data/programs'
import type { ActiveWorkout, CustomWorkout, LoggedExercise, LoggedSet, PlanItem, WorkoutSession } from '../types'
import { uid } from './util'
import { cloud } from './cloud'
import { computeRecords as computeRecordsPure, isPR, previousSets, summarizeSets, volumeOf, type PRecord } from './training'

export type { PRecord }
const trackingOf = (id: string) => exOf(id).tracking

/** Last weight used for an exercise, for smart pre-fill */
export function lastKg(exId: string): number {
  const prev = previousSets(exId, useApp.getState().sessions)
  const w = prev?.sets.filter((x) => x.kg > 0)
  return w && w.length ? w[w.length - 1].kg : 0
}

export function computeRecords(sessions: WorkoutSession[]): PRecord[] {
  return computeRecordsPure(sessions, trackingOf)
}

export function lastTime(exId: string): { text: string; date: string } | null {
  const prev = previousSets(exId, useApp.getState().sessions)
  if (!prev) return null
  return { text: summarizeSets(prev.sets, trackingOf(exId)), date: prev.date }
}

export function prevSetsOf(exId: string): LoggedSet[] {
  return previousSets(exId, useApp.getState().sessions)?.sets ?? []
}

export function setIsPR(exId: string, set: LoggedSet): boolean {
  return isPR(exId, set, trackingOf(exId), useApp.getState().sessions)
}

/** Build the starting rows for one exercise: previous performance first, template target second. */
function seedSets(item: PlanItem): LoggedSet[] {
  const prev = prevSetsOf(item.exId).filter((x) => (x.type ?? 'working') !== 'warmup')
  const n = Math.max(1, item.sets)
  return Array.from({ length: n }, (_, i) => {
    const p = prev[Math.min(i, prev.length - 1)]
    return {
      reps: p?.reps ?? item.reps ?? 0,
      kg: p?.kg ?? lastKg(item.exId),
      secs: p?.secs ?? item.secs,
      type: 'working' as const,
      done: false,
    }
  })
}

export function startWorkout(name: string, items: PlanItem[], programId?: string, dayIndex?: number) {
  const log: LoggedExercise[] = items.map((it) => ({ exId: it.exId, sets: seedSets(it), note: it.note }))
  const active: ActiveWorkout = { name, programId, dayIndex, startedAt: new Date().toISOString(), items, log, current: 0 }
  useApp.setState({ active })
}

/** Free-form session: start empty, add whatever you actually train. */
export function startEmpty(name: string) {
  useApp.setState({ active: { name, startedAt: new Date().toISOString(), items: [], log: [], current: 0 } })
}

export function itemFor(exId: string): PlanItem {
  const e = exOf(exId)
  return e.tracking === 'time' ? { exId, sets: 1, secs: 20, rest: 90 } : { exId, sets: 1, reps: 0, rest: useApp.getState().restDefault }
}

export function addExerciseToActive(exId: string) {
  const a = useApp.getState().active
  if (!a) return
  const item = itemFor(exId)
  useApp.setState({ active: { ...a, items: [...a.items, item], log: [...a.log, { exId, sets: seedSets(item) }], current: a.log.length } })
}

export function patchActive(fn: (a: ActiveWorkout) => ActiveWorkout) {
  const a = useApp.getState().active
  if (a) useApp.setState({ active: fn(a) })
}

/** Turn what was actually logged into a reusable routine (targets = what you did). */
export function routineFromLog(name: string, a: ActiveWorkout): CustomWorkout {
  const items: PlanItem[] = a.log.map((l, i) => {
    const work = l.sets.filter((s) => (s.type ?? 'working') !== 'warmup')
    const ref = work[work.length - 1] ?? l.sets[0]
    const tr = trackingOf(l.exId)
    return {
      exId: l.exId,
      sets: Math.max(1, l.sets.length),
      reps: tr === 'reps' ? ref?.reps : undefined,
      secs: tr === 'time' ? ref?.secs ?? 20 : undefined,
      rest: a.items[i]?.rest ?? useApp.getState().restDefault,
      target: summarizeSets(l.sets, tr) || undefined,
      note: l.note,
    }
  })
  return { id: uid(), name, items, createdAt: new Date().toISOString() }
}

export function finishWorkout(): { session: WorkoutSession; newPRs: PRecord[] } | null {
  const st = useApp.getState()
  const a = st.active
  if (!a) return null
  const before = new Map(computeRecords(st.sessions).map((r) => [r.exId, r]))
  const exercises = a.log
    .map((l) => ({ exId: l.exId, note: l.note, sets: l.sets.filter((s) => s.done).map((s) => ({ ...s, type: s.type ?? 'working' })) }))
    .filter((l) => l.sets.length)
  const volumeKg = exercises.reduce((v, e) => v + volumeOf(e.sets), 0)
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
    return r.date === session.startedAt && !!b && (r.value > b.value || (r.kind === 'weight' && b.kind !== 'weight'))
  })
  return { session, newPRs }
}
