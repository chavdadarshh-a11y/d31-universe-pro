import { wTxt } from './units'
// Pure training logic (no store / DOM imports) so it can be unit-tested with plain Node.
import type { LoggedSet, SetType, WorkoutSession } from '../types'
import type { Criterion, Ladder } from '../data/ladders'

export type Tracking = 'reps' | 'time'
export type PRecord = { exId: string; kind: 'weight' | 'reps' | 'time'; value: number; kg?: number; reps?: number; date: string }

export const SET_TYPES: SetType[] = ['warmup', 'working', 'drop', 'failure']
export const isWorking = (s: LoggedSet) => (s.type ?? 'working') !== 'warmup'

/** Epley estimated 1-rep max */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30))

/** Value used to rank a set for PRs. */
export function setScore(s: LoggedSet, tracking: Tracking): { kind: PRecord['kind']; value: number } {
  if (tracking === 'time') return { kind: 'time', value: s.secs ?? 0 }
  if (s.kg > 0) return { kind: 'weight', value: e1rm(s.kg, s.reps) }
  return { kind: 'reps', value: s.reps }
}

export const beats = (a: { kind: PRecord['kind']; value: number }, b?: { kind: PRecord['kind']; value: number }) =>
  !b || (a.kind === 'weight' && b.kind !== 'weight') || (a.kind === b.kind && a.value > b.value)

/** Personal records across all sessions. Warm-up sets never count. */
export function computeRecords(sessions: WorkoutSession[], trackingOf: (exId: string) => Tracking): PRecord[] {
  const best = new Map<string, PRecord>()
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const s of ordered) {
    for (const ex of s.exercises) {
      const tr = trackingOf(ex.exId)
      for (const set of ex.sets) {
        if (!set.done || !isWorking(set)) continue
        const sc = setScore(set, tr)
        if (sc.value <= 0) continue
        const cur = best.get(ex.exId)
        if (beats(sc, cur)) best.set(ex.exId, { exId: ex.exId, ...sc, kg: set.kg || undefined, reps: set.reps || undefined, date: s.startedAt })
      }
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** Would this set be a new PR versus everything logged before? */
export function isPR(exId: string, set: LoggedSet, tracking: Tracking, sessions: WorkoutSession[]): boolean {
  if (!isWorking(set)) return false
  const sc = setScore(set, tracking)
  if (sc.value <= 0) return false
  const prev = computeRecords(sessions, () => tracking).find((r) => r.exId === exId)
  return !!prev && beats(sc, prev)
}

/** Sets from the most recent session that included this exercise (done sets only). */
export function previousSets(exId: string, sessions: WorkoutSession[]): { sets: LoggedSet[]; date: string } | null {
  const sorted = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  for (const s of sorted) {
    const ex = s.exercises.find((e) => e.exId === exId)
    const sets = ex?.sets.filter((x) => x.done)
    if (sets && sets.length) return { sets, date: s.startedAt }
  }
  return null
}

const kgTxt = (kg: number) => wTxt(kg)

/** Short human summary: '4×8 @ 20kg', '3×10s', '20kg×8, 22.5kg×6'. */
export function summarizeSets(sets: LoggedSet[], tracking: Tracking): string {
  const done = sets.filter((s) => s.done)
  const base = done.length ? done : sets
  const work = base.filter(isWorking)
  const list = work.length ? work : base
  if (!list.length) return ''
  const one = (s: LoggedSet) => {
    if (tracking === 'time') return `${s.secs ?? 0}s${s.kg ? ` +${kgTxt(s.kg)}` : ''}`
    return s.kg ? `${kgTxt(s.kg)}×${s.reps}` : `${s.reps}`
  }
  const same = list.every((s) => s.reps === list[0].reps && s.kg === list[0].kg && (s.secs ?? 0) === (list[0].secs ?? 0))
  if (same) {
    const s = list[0]
    if (tracking === 'time') return `${list.length}×${s.secs ?? 0}s${s.kg ? ` @ ${kgTxt(s.kg)}` : ''}`
    return `${list.length}×${s.reps}${s.kg ? ` @ ${kgTxt(s.kg)}` : ''}`
  }
  const parts = list.slice(0, 4).map(one)
  return parts.join(', ') + (list.length > 4 ? ` +${list.length - 4}` : '')
}

/** Training volume (kg × reps) of working sets. */
export function volumeOf(sets: LoggedSet[]): number {
  return sets.filter((s) => s.done && isWorking(s)).reduce((v, s) => v + s.kg * s.reps, 0)
}

/** Does any single session contain `goal.sets` done working sets that each meet the criterion? */
export function meets(exId: string, goal: Criterion, sessions: WorkoutSession[]): boolean {
  for (const s of sessions) {
    const ex = s.exercises.find((e) => e.exId === exId)
    if (!ex) continue
    const ok = ex.sets.filter((x) => x.done && isWorking(x)).filter((x) =>
      goal.kind === 'hold' ? (x.secs ?? 0) >= goal.secs : x.reps >= goal.reps && (goal.minKg === undefined || x.kg >= goal.minKg),
    )
    if (ok.length >= goal.sets) return true
  }
  return false
}

/** Ladder status from the athlete's own logs: which steps are cleared and which is current. */
export function ladderStatus(ladder: Ladder, sessions: WorkoutSession[]): { cleared: boolean[]; current: number } {
  const cleared = ladder.steps.map((st) => meets(st.exId, st.goal, sessions))
  let current = 0
  while (current < cleared.length && cleared[current]) current++
  return { cleared, current: Math.min(current, ladder.steps.length - 1) }
}

export function criterionText(c: Criterion): string {
  return c.kind === 'hold' ? `${c.sets} × ${c.secs}s` : `${c.sets} × ${c.reps}${c.minKg ? ` @ +${c.minKg}kg` : ''}`
}

/** Is this set better than the stored record (used for the live PR badge)? */
export function beatsRecord(set: LoggedSet, tracking: Tracking, rec?: PRecord): boolean {
  if (!rec || !set.done || !isWorking(set)) return false
  const sc = setScore(set, tracking)
  return sc.value > 0 && beats(sc, rec)
}
