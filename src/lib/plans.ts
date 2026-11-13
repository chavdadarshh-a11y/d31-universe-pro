import type { PlanId } from '../types'
import { PLANS, PLAN_RANK, LAUNCH_SPOTS, GRACE_RULES } from '../config/plans'

export { PLANS, PLAN_RANK, LAUNCH_SPOTS, GRACE_RULES }
export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, (typeof PLANS)[number]>

export function hasPlan(current: PlanId, needed: PlanId) {
  return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[needed] ?? 0)
}

/** Old ids saved by earlier versions → current tiers. */
export function normalizePlan(p: string | undefined | null): PlanId {
  if (p === 'pro') return 'pro'
  if (p === 'gold') return 'gold'
  if (p === 'platinum' || p === 'premium' || p === 'coaching') return 'platinum'
  return 'free'
}

/** Grace hours for a pass that expired at `expiry` (local time). */
export function graceHoursFor(expiry: Date): number {
  const h = expiry.getHours()
  return GRACE_RULES.find((r) => h >= r.fromHour && h < r.toHour)?.hours ?? 1
}

/** Latest time this phone has seen — setting the clock back can't stretch a pass or a grace period. */
const CLOCK_KEY = 'd31-clock'
export function trustedNow(): number {
  const now = Date.now()
  let last = 0
  try { last = Number(localStorage.getItem(CLOCK_KEY)) || 0 } catch { /* private mode */ }
  const t = Math.max(now, last)
  try { if (t > last) localStorage.setItem(CLOCK_KEY, String(t)) } catch { /* ignore */ }
  return t
}

export type PassStatus = { plan: PlanId; state: 'free' | 'active' | 'grace' | 'expired'; until?: number; graceUntil?: number }

/** One place that decides the tier in force right now, including the grace period. */
export function passStatus(m: { plan: string; until?: string; source?: string }, now = trustedNow()): PassStatus {
  const p = normalizePlan(m.plan)
  if (p === 'free') return { plan: 'free', state: 'free' }
  if (!m.until) return { plan: p, state: 'active' }
  const end = new Date(m.until).getTime()
  if (now < end) return { plan: p, state: 'active', until: end }
  if (m.source === 'trial') return { plan: 'free', state: 'expired', until: end } // the free trial has no grace
  const graceUntil = end + graceHoursFor(new Date(end)) * 3600_000
  if (now < graceUntil) return { plan: p, state: 'grace', until: end, graceUntil }
  return { plan: 'free', state: 'expired', until: end, graceUntil }
}
