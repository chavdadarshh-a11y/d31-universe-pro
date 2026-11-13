import type { PlanItem } from '../types'

export function estimateMinutes(items: PlanItem[]): number {
  const sec = items.reduce((t, it) => t + it.sets * ((it.secs ?? (it.reps ?? 10) * 3.5) + it.rest), 0)
  return Math.max(5, Math.round(sec / 60 / 5) * 5)
}
