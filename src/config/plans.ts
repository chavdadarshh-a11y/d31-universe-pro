/**
 * Membership tiers, passes, trial, language access and Portal Pass credits.
 *
 * ALL VALUES live in ONE file: supabase/functions/_shared/pricing.json
 * (the payment server reads the same file, so the price shown is the price charged).
 * This module only adds types and derived values.
 * Feature lines only describe things the app really does and really gates.
 */
import pricing from '../../supabase/functions/_shared/pricing.json'
import type { PlanId } from '../types'

export type KLangId = 'en' | 'hi' | 'gu'
export type PassId = 'pro_30' | 'pro_365' | 'gold_30' | 'gold_365' | 'platinum_30' | 'platinum_365'
export type PaidPlan = Exclude<PlanId, 'free'>
export type PassConfig = { id: PassId; plan: PaidPlan; days: number; priceInr: number }
export type UnlockSku = 'video' | 'pdf' | 'pack'
export type PostPassId = 'post_1' | 'post_3' | 'post_30'
export type PostPassConfig = { id: PostPassId; name: string; posts: number; hours: number; priceInr: number }

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

/** Which Knowledge languages each tier can open (videos & PDFs) without a Portal Pass. */
export const KNOWLEDGE_LANGS = pricing.knowledgeLangs as Record<PlanId, KLangId[]>

/** À-la-carte SKUs are withdrawn (Portal Pass replaces them). Kept so old receipts still resolve. */
export const UNLOCKS = {
  offered: Boolean((pricing as { unlocks: { offered?: boolean } }).unlocks.offered),
  video: pricing.unlocks.video.inr,
  pdf: pricing.unlocks.pdf.inr,
  pack: { priceInr: pricing.unlocks.pack.inr, videos: pricing.unlocks.pack.videos, pdfs: pricing.unlocks.pack.pdfs },
  allowDownload: pricing.unlocks.allowDownload,
}
export const unlockPrice = (sku: UnlockSku) => (sku === 'pack' ? UNLOCKS.pack.priceInr : UNLOCKS[sku])

/** Portal Pass credit packs (website only). Hidden from Platinum — they already have every post. */
export const POST_PASSES: PostPassConfig[] = (pricing as { postPasses?: { id: string; name?: string; posts: number; hours: number; inr: number }[] }).postPasses?.map((p) => ({
  id: p.id as PostPassId, name: p.name ?? p.id, posts: p.posts, hours: p.hours, priceInr: p.inr,
})) ?? []
export const POST_PASS_BY_ID = Object.fromEntries(POST_PASSES.map((p) => [p.id, p])) as Record<PostPassId, PostPassConfig>
export const isPostPassId = (s: string): s is PostPassId => s in POST_PASS_BY_ID
export const postPassDuration = (p: PostPassConfig) => p.hours % 24 === 0 && p.hours >= 48
  ? { unit: 'days' as const, n: p.hours / 24 }
  : { unit: 'hours' as const, n: p.hours }

export const PAY_METHODS = pricing.payMethods as ('upi' | 'card' | 'netbanking' | 'wallet')[]

const founding = (pricing as { founding?: { name: string; cap: number; discountPct: number } }).founding
/** THE FIRST 131 — 25% lifetime membership discount for the first 131 verified paid members. */
export const FOUNDING = {
  name: founding?.name ?? 'THE FIRST 131',
  cap: founding?.cap ?? 131,
  discountPct: founding?.discountPct ?? 25,
}
/** @deprecated use FOUNDING.cap — kept so older imports compile */
export const LAUNCH_SPOTS = FOUNDING.cap

const referral = (pricing as { referral?: { rewardInr: number; maxPerMember: number } }).referral
export const REFERRAL = {
  rewardInr: referral?.rewardInr ?? 25,
  maxPerMember: referral?.maxPerMember ?? 5,
}

/** Whole-rupee price after a founding discount (same rounding the server uses). */
export const foundingPrice = (inr: number) => Math.round(inr * (100 - FOUNDING.discountPct) / 100)

export const GRACE_RULES: { fromHour: number; toHour: number; hours: number }[] = pricing.grace

export const perDay = (p: PassConfig) => p.priceInr / p.days
export const perMonth = (p: PassConfig) => (p.priceInr / p.days) * 30

export const POSITIONING: Record<PlanId, { role: string; line: string }> = {
  free: { role: 'Explore', line: 'Start your D31 journey' },
  pro: { role: 'Train', line: 'Build strength and master movement' },
  gold: { role: 'Master', line: 'Unlock deeper knowledge and training' },
  platinum: { role: 'Complete access', line: 'Enter the complete D31 Universe' },
}
