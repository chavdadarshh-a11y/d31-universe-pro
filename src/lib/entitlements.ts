/**
 * Single source of truth for what each tier unlocks. Every gate in the UI asks `can()`.
 */
import { useApp, effectivePlan, type Membership } from '../store/app'
import { hasPlan, passStatus, PLAN_BY_ID } from './plans'
import type { PlanId } from '../types'

export type Feature =
  | 'programs.pro' // Pro programs & skill paths
  | 'programs.platinum' // Platinum-only skill paths
  | 'photos.compare' // progress-photo side-by-side compare
  | 'download.programPdf' // program / workout plan PDF
  | 'download.history' // workout history PDF / CSV
  | 'download.clips' // save Darshan's clips for offline
  | 'download.knowledge' // PDFs / videos from Knowledge posts
  | 'download.backup' // JSON backup of your own data (always allowed — it's your data)
  | 'downloads.inApp' // save Knowledge videos / PDFs INSIDE the app (IndexedDB), never to the phone

export const FEATURE_PLAN: Record<Feature, PlanId> = {
  'programs.pro': 'pro',
  'programs.platinum': 'gold', // Gold unlocks every program & skill path
  'photos.compare': 'pro',
  'download.programPdf': 'gold', // your own program as a PDF
  'download.history': 'gold', // your own history as PDF / CSV
  'download.clips': 'platinum', // offline exercise clips (in-app cache)
  'download.knowledge': 'platinum', // Knowledge videos / PDFs saved in-app
  'downloads.inApp': 'platinum',
  'download.backup': 'free',
}

export function can(feature: Feature, plan: PlanId): boolean {
  return hasPlan(plan, FEATURE_PLAN[feature])
}

export const analysesFor = (plan: PlanId) => PLAN_BY_ID[plan].analyses

export function useCan(feature: Feature): boolean {
  const plan = useApp((s) => effectivePlan(s.membership))
  return can(feature, plan)
}

/** Program gate: a program's `plan` field is the tier it needs. */
export const canProgram = (needed: PlanId, plan: PlanId) => hasPlan(plan, needed)

/* ───────────── Grace period & downloads ─────────────
 * The rule lives in config/plans.ts (GRACE_RULES); passStatus() applies it, effectivePlan() uses it,
 * so during grace EVERY feature of the expired tier keeps working. After grace, saved downloads
 * stay in the app but lock until the user renews.
 */
export { GRACE_RULES, graceHoursFor, trustedNow, passStatus } from './plans'

export type DownloadAccess = { state: 'active' | 'grace' | 'locked'; graceUntil?: number }

export function downloadAccess(m: Membership): DownloadAccess {
  const st = passStatus(m)
  if (!hasPlan(st.plan, FEATURE_PLAN['downloads.inApp'])) return { state: 'locked' }
  return st.state === 'grace' ? { state: 'grace', graceUntil: st.graceUntil } : { state: 'active' }
}

export function useDownloadAccess(): DownloadAccess {
  const m = useApp((s) => s.membership)
  return downloadAccess(m)
}
