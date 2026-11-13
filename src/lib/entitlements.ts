/**
 * Single source of truth for what each tier unlocks. Every gate in the UI asks `can()`.
 */
import { useApp, effectivePlan } from '../store/app'
import { hasPlan, PLAN_BY_ID } from './plans'
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

export const FEATURE_PLAN: Record<Feature, PlanId> = {
  'programs.pro': 'pro',
  'programs.platinum': 'platinum',
  'photos.compare': 'pro',
  'download.programPdf': 'platinum',
  'download.history': 'platinum',
  'download.clips': 'platinum',
  'download.knowledge': 'platinum',
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
