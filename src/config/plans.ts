/**
 * Membership tiers, passes, trial, language access and à-la-carte unlocks.
 *
 * ALL VALUES live in ONE file: supabase/functions/_shared/pricing.json
 * (the payment server reads the same file, so the price shown is the price charged).
 * This module only adds types and derived values.
 * Feature lines only describe things the app really does and really gates.
 */
import pricing from '../../supabase/functions/_shared/pricing.json'
import type { PlanId } from '../types'

export type KLangId = 'en' | 'hi' | 'gu'
export type PassId = 'pro_30' | 'gold_30' | 'platinum_30' | 'platinum_90' | 'platinum_365'
export type PaidPlan = Exclude<PlanId, 'free'>
export type PassConfig = { id: PassId; plan: PaidPlan; days: number; priceInr: number }
export type UnlockSku = 'video' | 'pdf' | 'pack'

export const PLAN_IDS: PlanId[] = ['free', 'pro', 'gold', 'platinum']
export const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, gold: 2, platinum: 3 }

export const PASSES: PassConfig[] = pricing.passes.map((p) => ({ id: p.id as PassId, plan: p.plan as PaidPlan, days: p.days, priceInr: p.inr }))
export const PASS_BY_ID = Object.fromEntries(PASSES.map((p) => [p.id, p])) as Record<PassId, PassConfig>
export const passesFor = (plan: PlanId) => PASSES.filter((p) => p.plan === plan).sort((a, b) => a.days - b.days)
/** "Most popular" — a design label on one pass, nothing more (no counts, no claims). */
export const POPULAR_PASS = (pricing.popular || null) as PassId | null

export type PlanConfig = { id: PlanId; priceInr: number; periodDays: number; analyses: number; accent: string }
const ACCENT: Record<PlanId, string> = { free: '#8b93a3', pro: '#22d3ee', gold: '#f7c548', platinum: '#e5e4e2' }
export const PLANS: PlanConfig[] = PLAN_IDS.map((id) => {
  const base = id === 'free' ? undefined : passesFor(id)[0]
  return { id, priceInr: base?.priceInr ?? 0, periodDays: base?.days ?? 0, analyses: (pricing.analyses as Record<PlanId, number>)[id], accent: ACCENT[id] }
})

/** Every new account gets this once. */
export const TRIAL = { plan: pricing.trial.plan as PaidPlan, days: pricing.trial.days }
export const TRIAL_DAYS = TRIAL.days

/** Which Knowledge languages each tier can open (videos & PDFs). */
export const KNOWLEDGE_LANGS = pricing.knowledgeLangs as Record<PlanId, KLangId[]>

/** À-la-carte: buy single items; unlocked forever for that account, in every language. */
export const UNLOCKS = {
  video: pricing.unlocks.video.inr,
  pdf: pricing.unlocks.pdf.inr,
  pack: { priceInr: pricing.unlocks.pack.inr, videos: pricing.unlocks.pack.videos, pdfs: pricing.unlocks.pack.pdfs },
  allowDownload: pricing.unlocks.allowDownload,
}
export const unlockPrice = (sku: UnlockSku) => (sku === 'pack' ? UNLOCKS.pack.priceInr : UNLOCKS[sku])

/** Razorpay checkout order (UPI first). */
export const PAY_METHODS = pricing.payMethods as ('upi' | 'card' | 'netbanking' | 'wallet')[]

/** First N members get Pro free for a month (server-enforced when live; hidden unless the server reports a count). */
export const LAUNCH_SPOTS = 131

/**
 * GRACE PERIOD after a PAID pass expires: full access to that tier for a few hours, chosen by the
 * LOCAL hour the pass expired. After that, downloads stay stored but lock until renewal.
 * fromHour inclusive, toHour exclusive (24 h clock). The trial has no grace.
 */
export const GRACE_RULES: { fromHour: number; toHour: number; hours: number }[] = pricing.grace

/** Price helpers for cards: ₹/day and ₹/month equivalents. */
export const perDay = (p: PassConfig) => p.priceInr / p.days
export const perMonth = (p: PassConfig) => (p.priceInr / p.days) * 30
