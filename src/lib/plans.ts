import type { PlanId } from '../types'
import { PLANS, PLAN_RANK, LAUNCH_SPOTS } from '../config/plans'

export { PLANS, PLAN_RANK, LAUNCH_SPOTS }
export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, (typeof PLANS)[number]>

export function hasPlan(current: PlanId, needed: PlanId) {
  return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[needed] ?? 0)
}

/** Old ids saved by earlier versions → current tiers. */
export function normalizePlan(p: string | undefined | null): PlanId {
  if (p === 'pro') return 'pro'
  if (p === 'platinum' || p === 'premium' || p === 'coaching') return 'platinum'
  return 'free'
}
