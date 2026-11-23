/** Game mode: challenges, bosses, XP / levels, day streaks and badges — computed only from the user's own results. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { currentAccountId } from './accountKeys'
import { dayKey, uid } from './util'
import type { CamKind } from './repCam'

export type ChallengeId = 'push60' | 'squat60' | 'jacks45' | 'burpee90' | 'plank' | 'boss1' | 'boss2'
export type Round = { exId: string; reps: number; cam?: CamKind }
export type Challenge = {
  id: ChallengeId; color: string; exId: string; cam?: CamKind
  /** timed max-reps (sec) */ sec?: number
  /** hold as long as you can */ hold?: boolean
  /** boss: rounds to clear inside `sec` */ rounds?: Round[]
  /** level needed to enter */ minLevel?: number
}
export const CHALLENGES: Challenge[] = [
  { id: 'push60', color: '#22d3ee', exId: 'push-up', cam: 'pushup', sec: 60 },
  { id: 'squat60', color: '#a3e635', exId: 'bodyweight-squat', cam: 'squat', sec: 60 },
  { id: 'jacks45', color: '#f472d0', exId: 'jumping-jack', cam: 'jacks', sec: 45 },
  { id: 'burpee90', color: '#fb923c', exId: 'burpee', sec: 90 },
  { id: 'plank', color: '#a78bfa', exId: 'plank', hold: true },
  { id: 'boss1', color: '#f7c548', exId: 'bodyweight-squat', sec: 300, rounds: [{ exId: 'bodyweight-squat', reps: 20, cam: 'squat' }, { exId: 'push-up', reps: 15, cam: 'pushup' }, { exId: 'jumping-jack', reps: 30, cam: 'jacks' }] },
  { id: 'boss2', color: '#ef4444', exId: 'bodyweight-squat', sec: 360, minLevel: 4, rounds: [{ exId: 'bodyweight-squat', reps: 40, cam: 'squat' }, { exId: 'push-up', reps: 30, cam: 'pushup' }, { exId: 'burpee', reps: 15 }, { exId: 'jumping-jack', reps: 50, cam: 'jacks' }] },
]
export const challenge = (id: string) => CHALLENGES.find((c) => c.id === id)

export type GameResult = {
  id: string; at: string; challenge: ChallengeId
  /** reps (or seconds for holds) */ score: number
  xp: number; bestCombo: number; deepReps: number; camera: boolean
  win?: boolean; durationSec: number
  perEx: Record<string, number>
}

/** XP → level: level n needs 60·n·(n+1)/2 total XP */
export const xpForLevel = (n: number) => 30 * n * (n + 1)
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let n = 0
  while (xpForLevel(n + 1) <= xp) n++
  return { level: n + 1, into: xp - xpForLevel(n), need: xpForLevel(n + 1) - xpForLevel(n) }
}
export const RANKS = ['rank_rookie', 'rank_fighter', 'rank_warrior', 'rank_titan', 'rank_legend', 'rank_cosmic'] as const
export const rankOf = (level: number) => RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))]

/** combo multiplier: every 5 quick reps in a row → +0.5×, max 3× */
export const comboMult = (combo: number) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5)
export const COMBO_WINDOW_MS = 3000

export function dayStreak(results: GameResult[], now = new Date()): number {
  const days = new Set(results.map((r) => dayKey(r.at)))
  let n = 0
  const d = new Date(now)
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1) // today not played yet → the streak is still alive from yesterday
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export type BadgeId = 'first' | 'reps100' | 'reps1000' | 'combo20' | 'boss1' | 'boss2' | 'streak3' | 'streak7' | 'deep20' | 'plank120' | 'push50' | 'cam10'
export const BADGES: { id: BadgeId; icon: string; color: string; test: (r: GameResult[], s: GameStats) => boolean }[] = [
  { id: 'first', icon: '⚡', color: '#22d3ee', test: (r) => r.length > 0 },
  { id: 'reps100', icon: '💯', color: '#a3e635', test: (_, s) => s.totalReps >= 100 },
  { id: 'reps1000', icon: '🔱', color: '#f7c548', test: (_, s) => s.totalReps >= 1000 },
  { id: 'combo20', icon: '🔥', color: '#fb923c', test: (r) => r.some((x) => x.bestCombo >= 20) },
  { id: 'boss1', icon: '👑', color: '#f7c548', test: (r) => r.some((x) => x.challenge === 'boss1' && x.win) },
  { id: 'boss2', icon: '🐉', color: '#ef4444', test: (r) => r.some((x) => x.challenge === 'boss2' && x.win) },
  { id: 'streak3', icon: '📅', color: '#a78bfa', test: (_, s) => s.bestStreak >= 3 },
  { id: 'streak7', icon: '🌌', color: '#f472d0', test: (_, s) => s.bestStreak >= 7 },
  { id: 'deep20', icon: '🕳️', color: '#34d399', test: (_, s) => s.deepReps >= 20 },
  { id: 'plank120', icon: '🛡️', color: '#60a5fa', test: (r) => r.some((x) => x.challenge === 'plank' && x.score >= 120) },
  { id: 'push50', icon: '💥', color: '#22d3ee', test: (r) => r.some((x) => x.challenge === 'push60' && x.score >= 50) },
  { id: 'cam10', icon: '🎥', color: '#a78bfa', test: (r) => r.filter((x) => x.camera).length >= 10 },
]

export type GameStats = { xp: number; totalReps: number; deepReps: number; games: number; streak: number; bestStreak: number; best: Partial<Record<ChallengeId, number>> }
export function statsOf(results: GameResult[]): GameStats {
  const best: Partial<Record<ChallengeId, number>> = {}
  let xp = 0, totalReps = 0, deepReps = 0
  for (const r of results) {
    xp += r.xp; deepReps += r.deepReps
    if (r.challenge !== 'plank') totalReps += r.score
    const isBoss = r.challenge.startsWith('boss')
    const v = isBoss ? (r.win ? r.durationSec : undefined) : r.score
    if (v !== undefined) best[r.challenge] = isBoss ? Math.min(best[r.challenge] ?? Infinity, v) : Math.max(best[r.challenge] ?? 0, v)
  }
  // best streak ever
  const days = Array.from(new Set(results.map((r) => dayKey(r.at)))).sort()
  let bestStreak = 0, run = 0, prev: string | null = null
  for (const d of days) {
    if (prev) { const p = new Date(prev); p.setDate(p.getDate() + 1); run = dayKey(p) === d ? run + 1 : 1 } else run = 1
    bestStreak = Math.max(bestStreak, run); prev = d
  }
  return { xp, totalReps, deepReps, games: results.length, streak: dayStreak(results), bestStreak, best }
}
export const earnedBadges = (results: GameResult[]) => { const s = statsOf(results); return new Set(BADGES.filter((b) => b.test(results, s)).map((b) => b.id)) }

type GameStore = {
  byAcc: Record<string, GameResult[]>
  add: (r: Omit<GameResult, 'id'>) => GameResult
}
const acc = () => currentAccountId() ?? 'guest'
export const useGame = create<GameStore>()(persist((set, get) => ({
  byAcc: {},
  add: (r) => {
    const row = { ...r, id: uid() }
    const k = acc()
    set({ byAcc: { ...get().byAcc, [k]: [row, ...(get().byAcc[k] ?? [])].slice(0, 1000) } })
    return row
  },
}), { name: 'd31-game-v1' }))
const EMPTY: GameResult[] = []
export const useMyGames = () => useGame((s) => s.byAcc[acc()] ?? EMPTY)
