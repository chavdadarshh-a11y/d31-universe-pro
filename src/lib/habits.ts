/**
 * Daily habit loop (works for guests; syncs when signed in):
 *  • a 10–15 minute bodyweight plan for today (same plan all day, changes with the weekday and goal)
 *  • one-tap "Workout done" → counts in the streak together with logged workouts
 *  • streak / best streak computed only from the user's own data (no made-up numbers)
 * Pure functions (no store / DOM imports) so scripts/test-habits.ts can run them in Node.
 */
import type { Goal, Level, PlanItem, WorkoutSession } from '../types'

export type Focus = 'full' | 'core' | 'mobility' | 'pushlegs'
export type DailyPlan = { focus: Focus; items: PlanItem[] }

const T: Record<Focus, PlanItem[]> = {
  full: [
    { exId: 'bodyweight-squat', sets: 3, reps: 12, rest: 45 },
    { exId: 'push-up', sets: 3, reps: 10, rest: 45 },
    { exId: 'forward-lunge', sets: 2, reps: 10, rest: 45 },
    { exId: 'plank', sets: 3, secs: 30, rest: 30 },
  ],
  core: [
    { exId: 'jumping-jack', sets: 3, reps: 20, rest: 30 },
    { exId: 'burpee', sets: 2, reps: 8, rest: 45 },
    { exId: 'plank', sets: 3, secs: 30, rest: 30 },
    { exId: 'side-plank', sets: 2, secs: 20, rest: 20 },
  ],
  mobility: [
    { exId: 'cat-cow', sets: 2, reps: 10, rest: 20 },
    { exId: 'worlds-greatest-stretch', sets: 2, reps: 6, rest: 20 },
    { exId: 'deep-squat-hold', sets: 3, secs: 40, rest: 20 },
    { exId: 'couch-stretch', sets: 2, secs: 45, rest: 15 },
    { exId: 'bodyweight-squat', sets: 2, reps: 12, rest: 30 },
  ],
  pushlegs: [
    { exId: 'push-up', sets: 3, reps: 8, rest: 45 },
    { exId: 'hip-thrust', sets: 3, reps: 12, rest: 45 },
    { exId: 'calf-raise', sets: 2, reps: 15, rest: 30 },
    { exId: 'plank', sets: 2, secs: 30, rest: 30 },
  ],
}

/** Week rotation (Sunday = 0) per goal. */
const ROTATION: Record<Goal, Focus[]> = {
  muscle: ['mobility', 'full', 'pushlegs', 'core', 'full', 'pushlegs', 'core'],
  strength: ['mobility', 'full', 'pushlegs', 'core', 'full', 'pushlegs', 'core'],
  skills: ['mobility', 'full', 'pushlegs', 'core', 'full', 'pushlegs', 'core'],
  fatloss: ['mobility', 'core', 'full', 'core', 'pushlegs', 'core', 'full'],
  mobility: ['mobility', 'full', 'mobility', 'core', 'mobility', 'pushlegs', 'mobility'],
}

export const DAILY_PLAN_EX_IDS = [...new Set(Object.values(T).flat().map((i) => i.exId))]

/** Today's plan. Beginners get the base volume; intermediate / advanced get a few more reps / seconds. */
export function dailyPlan(date: Date, goal: Goal = 'muscle', level: Level = 'beginner'): DailyPlan {
  const focus = (ROTATION[goal] ?? ROTATION.muscle)[date.getDay()]
  const k = level === 'advanced' ? 1.4 : level === 'intermediate' ? 1.2 : 1
  const add = level === 'advanced' ? 20 : level === 'intermediate' ? 10 : 0
  const items = T[focus].map((it) => ({ ...it, ...(it.reps ? { reps: Math.round(it.reps * k) } : {}), ...(it.secs ? { secs: it.secs + add } : {}) }))
  return { focus, items }
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sessionDay = (s: WorkoutSession) => key(new Date(s.startedAt))

/** Every day with a logged workout or a "Workout done" tap. */
export function activeDays(sessions: WorkoutSession[], doneDays: string[]): Set<string> {
  return new Set([...sessions.map(sessionDay), ...doneDays])
}

export function isDoneOn(day: string, sessions: WorkoutSession[], doneDays: string[]) {
  return doneDays.includes(day) || sessions.some((s) => sessionDay(s) === day)
}

/** Current streak: ends today, or yesterday when today is not done yet. */
export function streak(sessions: WorkoutSession[], doneDays: string[], now = new Date()): number {
  const days = activeDays(sessions, doneDays)
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!days.has(key(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(key(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

/** Longest run of consecutive active days ever. */
export function bestStreak(sessions: WorkoutSession[], doneDays: string[]): number {
  const days = [...activeDays(sessions, doneDays)].sort()
  let best = 0, run = 0, prev: Date | null = null
  for (const s of days) {
    const [y, m, dd] = s.split('-').map(Number)
    const d = new Date(y, m - 1, dd)
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Last 7 days (oldest first) → done or not, for the little week strip. */
export function weekStrip(sessions: WorkoutSession[], doneDays: string[], now = new Date()): { day: string; done: boolean; date: Date }[] {
  const days = activeDays(sessions, doneDays)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
    return { day: key(d), done: days.has(key(d)), date: d }
  })
}

/** Next reminder time from now (skips today when already done or already past). */
export function nextFire(r: { enabled: boolean; time: string; days: number[] }, now = new Date(), doneToday = false): Date | null {
  if (!r.enabled || !r.days.length) return null
  const [h, m] = r.time.split(':').map(Number)
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0)
    if (!r.days.includes(d.getDay())) continue
    if (i === 0 && (doneToday || d.getTime() <= now.getTime())) continue
    return d
  }
  return null
}

