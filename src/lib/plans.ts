import type { PlanId } from '../types'
import type { StringKey } from '../i18n/strings'

export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, premium: 2, coaching: 3 }

export const PLANS: { id: PlanId; priceInr: number; analyses: number; features: StringKey[]; highlight?: boolean }[] = [
  { id: 'free', priceInr: 0, analyses: 3, features: ['f_library', 'f_free_programs', 'f_camera', 'f_tracking', 'f_analysis3'] },
  { id: 'pro', priceInr: 149, analyses: 30, features: ['f_all_programs', 'f_analysis30', 'f_photos', 'f_camera', 'f_tracking'], highlight: true },
  { id: 'premium', priceInr: 499, analyses: 100, features: ['f_all_programs', 'f_premium_programs', 'f_analysis100', 'f_priority', 'f_photos'] },
  { id: 'coaching', priceInr: 1499, analyses: 300, features: ['f_coach', 'f_custom', 'f_chat', 'f_analysisU', 'f_premium_programs'] },
]

export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanId, (typeof PLANS)[number]>

export const LAUNCH_SPOTS = 131

export function hasPlan(current: PlanId, needed: PlanId) {
  return PLAN_RANK[current] >= PLAN_RANK[needed]
}
