/** Running: GPS maths, guided run plans and the per-account run history (stored on the phone). */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from './util'
import { currentAccountId } from './accountKeys'

export type RunKind = 'free' | 'easy' | 'intervals' | 'tempo'
export type RunMode = 'gps' | 'treadmill' | 'manual'
export type LatLng = [number, number]
export type Run = {
  id: string; startedAt: string; durationSec: number; distanceM: number
  mode: RunMode; kind: RunKind
  /** simplified route (≤ 600 points) */
  path?: LatLng[]
  /** seconds taken for each full kilometre */
  splits: number[]
  inclinePct?: number; note?: string
}
export type Seg = { kind: 'warm' | 'easy' | 'fast' | 'tempo' | 'cool'; sec: number }
export const RUN_PLANS: Record<RunKind, Seg[]> = {
  free: [],
  easy: [{ kind: 'easy', sec: 30 * 60 }],
  intervals: [{ kind: 'warm', sec: 5 * 60 }, ...Array.from({ length: 6 }, () => [{ kind: 'fast' as const, sec: 60 }, { kind: 'easy' as const, sec: 120 }]).flat(), { kind: 'cool', sec: 5 * 60 }],
  tempo: [{ kind: 'warm', sec: 10 * 60 }, { kind: 'tempo', sec: 20 * 60 }, { kind: 'cool', sec: 5 * 60 }],
}
export const planSec = (k: RunKind) => RUN_PLANS[k].reduce((n, s) => n + s.sec, 0)
/** where in the plan we are after `t` seconds */
export function segAt(k: RunKind, t: number): { i: number; seg: Seg; left: number; next?: Seg } | null {
  const plan = RUN_PLANS[k]
  let acc = 0
  for (let i = 0; i < plan.length; i++) {
    acc += plan[i].sec
    if (t < acc) return { i, seg: plan[i], left: acc - t, next: plan[i + 1] }
  }
  return null
}

const R = 6371000
export function haversine(a: LatLng, b: LatLng): number {
  const toR = Math.PI / 180
  const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
/** sec per km → "5:32" */
export function fmtPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return '–:––'
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}
export const fmtKm = (m: number) => (m / 1000).toFixed(m >= 100000 ? 0 : 2)
/** rough energy estimate: ≈ 1 kcal per kg per km */
export const runKcal = (distanceM: number, weightKg: number) => Math.round((distanceM / 1000) * (weightKg || 70))

/** keep at most n points, evenly spaced (endpoints kept) */
export function thin(path: LatLng[], n = 600): LatLng[] {
  if (path.length <= n) return path
  const out: LatLng[] = []
  const step = (path.length - 1) / (n - 1)
  for (let i = 0; i < n; i++) out.push(path[Math.round(i * step)])
  return out
}

/** One GPS fix → accept or reject (bad accuracy, teleport jumps, jitter while standing). */
export type Fix = { lat: number; lng: number; acc: number; t: number }
export function acceptFix(prev: Fix | null, f: Fix): { ok: boolean; d: number } {
  if (f.acc > 40) return { ok: false, d: 0 }
  if (!prev) return { ok: true, d: 0 }
  const d = haversine([prev.lat, prev.lng], [f.lat, f.lng])
  const dt = Math.max(0.5, (f.t - prev.t) / 1000)
  if (d / dt > 12.5) return { ok: false, d: 0 } // faster than a sprinter → GPS jump
  if (d < Math.max(2.5, Math.min(f.acc, prev.acc) * 0.35)) return { ok: false, d: 0 } // jitter
  return { ok: true, d }
}

/** split times (sec per completed km) from cumulative [distanceM, elapsedSec] samples */
export function splitsFrom(samples: [number, number][]): number[] {
  const out: number[] = []
  let k = 1, lastT = 0
  for (let i = 1; i < samples.length; i++) {
    const [d0, t0] = samples[i - 1], [d1, t1] = samples[i]
    while (d1 >= k * 1000 && d1 > d0) {
      const f = (k * 1000 - d0) / (d1 - d0)
      const t = t0 + f * (t1 - t0)
      out.push(Math.round(t - lastT)); lastT = t; k++
    }
  }
  return out
}

type RunStore = {
  byAcc: Record<string, Run[]>
  add: (r: Omit<Run, 'id'>) => Run
  remove: (id: string) => void
}
const acc = () => currentAccountId() ?? 'guest'
export const useRuns = create<RunStore>()(persist((set, get) => ({
  byAcc: {},
  add: (r) => {
    const row = { ...r, id: uid() }
    const k = acc()
    set({ byAcc: { ...get().byAcc, [k]: [row, ...(get().byAcc[k] ?? [])].slice(0, 500) } })
    return row
  },
  remove: (id) => { const k = acc(); set({ byAcc: { ...get().byAcc, [k]: (get().byAcc[k] ?? []).filter((r) => r.id !== id) } }) },
}), { name: 'd31-runs-v1' }))
export const useMyRuns = () => useRuns((s) => s.byAcc[acc()] ?? EMPTY)
const EMPTY: Run[] = []

/** the live run is kept on the phone so a reload / app switch never loses it */
export type LiveRun = {
  kind: RunKind; mode: 'gps' | 'treadmill'; startedAt: number; pausedMs: number; pausedAt: number | null
  distanceM: number; path: LatLng[]; samples: [number, number][]; last: Fix | null
}
const LIVE_KEY = 'd31-run-live'
export const saveLive = (l: LiveRun | null) => { try { if (l) localStorage.setItem(LIVE_KEY, JSON.stringify({ ...l, path: thin(l.path, 1500) })); else localStorage.removeItem(LIVE_KEY) } catch { /* quota */ } }
export const loadLive = (): LiveRun | null => { try { const s = localStorage.getItem(LIVE_KEY); return s ? (JSON.parse(s) as LiveRun) : null } catch { return null } }
export const liveElapsed = (l: LiveRun, now = Date.now()) => Math.max(0, ((l.pausedAt ?? now) - l.startedAt - l.pausedMs) / 1000)
