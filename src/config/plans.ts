/**
 * ONE place to configure membership tiers.
 *
 * Prices are INR per 30-day pass. They come from the app's existing Razorpay config
 * (Pro ₹149 and the former "Premium" ₹499, now called Platinum). If you change a price here,
 * change PLAN_PRICES_PAISE in supabase/functions/_shared/http.ts too — the server decides the
 * amount actually charged, never the browser.
 *
 * Feature lines only describe things the app really does and really gates.
 */
import type { PlanId } from '../types'

export const PLAN_IDS: PlanId[] = ['free', 'pro', 'platinum']
export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, platinum: 2 }

export type PlanConfig = { id: PlanId; priceInr: number; periodDays: number; analyses: number; highlight?: boolean; accent: string }

export const PLANS: PlanConfig[] = [
  { id: 'free', priceInr: 0, periodDays: 0, analyses: 3, accent: '#8b93a3' },
  { id: 'pro', priceInr: 149, periodDays: 30, analyses: 30, highlight: true, accent: '#22d3ee' },
  { id: 'platinum', priceInr: 499, periodDays: 30, analyses: 100, accent: '#e5e4e2' },
]

/** First N members get Pro free for a month (server-enforced when live). */
export const LAUNCH_SPOTS = 131
export const TRIAL_DAYS = 7
