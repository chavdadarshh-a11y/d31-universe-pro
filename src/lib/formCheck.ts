/**
 * On-device form check (no API key needed). Pure functions — no DOM.
 * Rules: every number comes from a body point MediaPipe reports as clearly visible
 * (poseFilter.reliable). Nothing is guessed for hidden joints. Angles are measured in
 * pixel space (aspect-correct), in the 2-D photo.
 */
import EXJSON from '../data/analysis/exercises.json'
import RULES from '../data/analysis/rules.json'
import MUSCLES from '../data/analysis/muscles.json'
import { EXERCISES, EX_BY_ID } from '../data/exercises'
import { conf, plausiblePose, reliable, type Pt } from './poseFilter'
import type { Category, Lang, MuscleId } from '../types'

export type Mode = 'angles' | 'muscles' | 'technique'
export type L3 = { en: string; hi: string; gu: string }
export type Status = 'ok' | 'warn' | 'fix' | 'info'
export type View = 'front' | 'back' | 'side'
type Band = { r: [number, number]; s: Status } & L3
type Check = { metric: string; bands: Band[]; when?: Record<string, [number, number]>; skipFor?: string[]; onlyIfMissing?: string }
export type TechItem = { type: 'arrow' | 'extend' | 'arc'; from?: string; to?: string; center?: string; through?: string; label: L3 }
export type Profile = { focus: L3; angles: string[]; checks: Check[]; cues: L3[]; technique?: TechItem[] }

const PROFILES = RULES.profiles as unknown as Record<string, Profile>
const LABELS = RULES.metricLabels as unknown as Record<string, L3>
const MAP = EXJSON.map as Record<string, { mode: Mode; profile: string }>
const DEFAULT_MODE = EXJSON.defaultModeByCategory as Record<Category, Mode>
export type AnalysisExercise = { id: string; name: string; nameHi: string; nameGu: string; category: Category; primary: MuscleId[]; secondary: MuscleId[] }
const EXTRAS = EXJSON.extras as unknown as AnalysisExercise[]
export const MUSCLE_NAMES = MUSCLES.names as Record<MuscleId, L3>
const MUSCLE_OVERRIDE = MUSCLES.byExercise as Record<string, { primary: MuscleId[]; secondary: MuscleId[] }>

/** Library + analysis-only exercises (boxing, kicks, stretches) for the Exercise field. */
export const ANALYSIS_EXERCISES: AnalysisExercise[] = [
  ...EXERCISES.filter((e) => e.id !== 'unknown').map((e) => ({ id: e.id, name: e.name, nameHi: e.nameHi, nameGu: e.nameGu, category: e.category, primary: e.primary, secondary: e.secondary })),
  ...EXTRAS,
]
const BY_ID: Record<string, AnalysisExercise> = Object.fromEntries(ANALYSIS_EXERCISES.map((e) => [e.id, e]))
export const analysisEx = (id?: string): AnalysisExercise | undefined => (id ? BY_ID[id] ?? (EX_BY_ID[id] as AnalysisExercise | undefined) : undefined)
export const l3 = (x: L3 | undefined, lang: Lang) => (x ? x[lang] || x.en : '')
export const exLabel = (e: AnalysisExercise | undefined, lang: Lang) => (!e ? '' : lang === 'hi' ? e.nameHi || e.name : lang === 'gu' ? e.nameGu || e.name : e.name)

export function searchExercises(q: string, limit = 8): AnalysisExercise[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const words = s.split(/\s+/)
  const score = (e: AnalysisExercise) => {
    const hay = `${e.name} ${e.nameHi} ${e.nameGu} ${e.id.replace(/-/g, ' ')}`.toLowerCase()
    if (!words.every((w) => hay.includes(w))) return -1
    return (e.name.toLowerCase().startsWith(s) ? 2 : 0) + (hay.includes(s) ? 1 : 0)
  }
  return ANALYSIS_EXERCISES.map((e) => [e, score(e)] as const).filter(([, sc]) => sc >= 0).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([e]) => e)
}

export function exerciseSetup(id?: string): { mode: Mode; profileId: string; profile: Profile } {
  const e = analysisEx(id)
  const m = id ? MAP[id] : undefined
  const profileId = m?.profile && PROFILES[m.profile] ? m.profile : 'generic'
  const mode: Mode = m?.mode ?? (e ? DEFAULT_MODE[e.category] ?? 'muscles' : 'angles')
  return { mode, profileId, profile: PROFILES[profileId] }
}

export function musclesFor(id?: string): { primary: MuscleId[]; secondary: MuscleId[] } {
  if (id && MUSCLE_OVERRIDE[id]) return MUSCLE_OVERRIDE[id]
  const e = analysisEx(id)
  return e ? { primary: e.primary, secondary: e.secondary.filter((m) => !e.primary.includes(m)) } : { primary: [], secondary: [] }
}

// ---------- geometry ----------
export type P = { x: number; y: number }
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y })
const len = (a: P) => Math.hypot(a.x, a.y)
const dist = (a: P, b: P) => len(sub(a, b))
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const DEG = 180 / Math.PI
export function angleAt(a: P, b: P, c: P) {
  const v1 = sub(a, b), v2 = sub(c, b)
  const d = (v1.x * v2.x + v1.y * v2.y) / (len(v1) * len(v2) || 1)
  return Math.acos(Math.max(-1, Math.min(1, d))) * DEG
}
/** angle of vector vs horizontal, 0..90 */
const vsHorizontal = (v: P) => { const a = Math.abs(Math.atan2(v.y, v.x) * DEG); return a > 90 ? 180 - a : a }
/** angle of vector vs straight up (0 = pointing up, 180 = pointing down) */
const vsUp = (v: P) => Math.acos(Math.max(-1, Math.min(1, -v.y / (len(v) || 1)))) * DEG

export const IDX = { nose: 0, lsh: 11, rsh: 12, lel: 13, rel: 14, lwr: 15, rwr: 16, lhip: 23, rhip: 24, lknee: 25, rknee: 26, lank: 27, rank: 28, lheel: 29, rheel: 30, ltoe: 31, rtoe: 32 }
const SIDES = [
  { k: 'l', sh: 11, el: 13, wr: 15, hip: 23, knee: 25, ank: 27, heel: 29, toe: 31 },
  { k: 'r', sh: 12, el: 14, wr: 16, hip: 24, knee: 26, ank: 28, heel: 30, toe: 32 },
] as const

export type Metric = { v: number; at?: P; a?: P; c?: P }
export type Pose = {
  ok: boolean
  W: number
  H: number
  /** pixel points, only for clearly visible landmarks */
  pts: Record<number, P>
  vis: number[]
  view: View
  /** unit vector pointing to the body's front (side view) */
  front?: P
  metrics: Record<string, Metric>
  named: Record<string, P>
  torsoLen: number
  inverted: boolean
  /** relative depth per landmark (smaller = nearer camera), when known */
  z?: Record<number, number>
  /** shoulder separation / torso length (≈0 pure side view, ≥0.55 front/back) */
  spread?: number
}

export function buildPose(lm: Pt[] | null | undefined, W: number, H: number): Pose {
  const empty: Pose = { ok: false, W, H, pts: {}, vis: [], view: 'side', metrics: {}, named: {}, torsoLen: 0, inverted: false }
  if (!lm || lm.length < 33 || !plausiblePose(lm, W / (H || 1))) return empty
  const pts: Record<number, P> = {}
  const z: Record<number, number> = {}
  for (let i = 0; i < 33; i++) if (reliable(lm[i])) { pts[i] = { x: lm[i].x * W, y: lm[i].y * H }; const zz = (lm[i] as { z?: number }).z; if (typeof zz === 'number') z[i] = zz }
  const has = (...ids: number[]) => ids.every((i) => pts[i])
  const vis = Object.keys(pts).map(Number)
  const anyOf = (a: number, b: number): P | undefined => (pts[a] && pts[b] ? mid(pts[a], pts[b]) : pts[a] ?? pts[b])
  const shM = anyOf(11, 12), hipM = anyOf(23, 24)
  if (!shM || !hipM) return { ...empty, ok: vis.length >= 3, pts, vis }
  const kneeM = anyOf(25, 26), ankM = anyOf(27, 28), wrM = anyOf(15, 16)
  const torsoLen = dist(shM, hipM)
  const metrics: Record<string, Metric> = {}
  const named: Record<string, P> = { shM, hipM }
  if (kneeM) named.kneeM = kneeM
  if (ankM) named.ankM = ankM
  if (wrM) named.wrM = wrM
  const far = ankM ?? kneeM
  if (far) named.far = far

  // view: front / back / side from shoulder separation vs torso axis
  let view: View = 'side'
  let front: P | undefined
  const up = sub(shM, hipM)
  let spread: number | undefined
  if (has(11, 12)) {
    const r = sub(pts[11], pts[12])
    spread = len(r) / (torsoLen || 1)
    const cross = up.x * r.y - up.y * r.x
    if (len(r) > 0.55 * torsoLen) view = cross > 0 ? 'front' : 'back'
  }
  if (view === 'side') {
    const n = { x: -up.y / (len(up) || 1), y: up.x / (len(up) || 1) }
    // nose direction (face points to the front); else toes
    let s = 0
    if (pts[0]) s = (pts[0].x - shM.x) * n.x + (pts[0].y - shM.y) * n.y
    if (Math.abs(s) < 0.05 * torsoLen) {
      for (const sd of SIDES) if (pts[sd.toe] && pts[sd.heel]) s += (pts[sd.toe].x - pts[sd.heel].x) * n.x + (pts[sd.toe].y - pts[sd.heel].y) * n.y
    }
    if (Math.abs(s) > 0.03 * torsoLen) front = s > 0 ? n : { x: -n.x, y: -n.y }
  }

  // per-side joint angles, best side by confidence
  const best = (name: string, ids: (s: (typeof SIDES)[number]) => [number, number, number]) => {
    let pick: { v: number; at: P; a: P; c: P; sc: number } | undefined
    const all: number[] = []
    for (const sd of SIDES) {
      const [a, b, c] = ids(sd)
      if (!has(a, b, c)) continue
      const v = angleAt(pts[a], pts[b], pts[c])
      all.push(v)
      const sc = Math.min(conf(lm[a]), conf(lm[b]), conf(lm[c]))
      if (!pick || sc > pick.sc) pick = { v, at: pts[b], a: pts[a], c: pts[c], sc }
    }
    if (pick) metrics[name] = { v: pick.v, at: pick.at, a: pick.a, c: pick.c }
    return all
  }
  const knees = best('knee', (s) => [s.hip, s.knee, s.ank])
  best('hip', (s) => [s.sh, s.hip, s.knee])
  const elbows = best('elbow', (s) => [s.sh, s.el, s.wr])
  best('shoulder', (s) => [s.hip, s.sh, s.el])
  best('hipLine', (s) => [s.sh, s.hip, s.ank])
  if (knees.length) {
    const i = knees.indexOf(Math.min(...knees))
    const sd = SIDES.filter((s) => has(s.hip, s.knee, s.ank))[i]
    metrics.kneeMin = { v: knees[i], at: pts[sd.knee], a: pts[sd.hip], c: pts[sd.ank] }
  }
  if (elbows.length) {
    const i = elbows.indexOf(Math.min(...elbows))
    const sd = SIDES.filter((s) => has(s.sh, s.el, s.wr))[i]
    metrics.elbowMin = { v: elbows[i], at: pts[sd.el], a: pts[sd.sh], c: pts[sd.wr] }
  }

  metrics.trunkLean = { v: vsUp(up), at: hipM, a: shM }
  metrics.torsoLine = { v: vsHorizontal(up), at: shM, a: hipM }
  const inverted = up.y > 0.35 * torsoLen // shoulders clearly below hips
  if (far) {
    const line = sub(far, shM)
    if (len(line) > 1.2 * torsoLen) {
      metrics.bodyLine = { v: vsHorizontal(line), at: shM, a: far }
      metrics.bodyFromVertical = { v: 90 - vsHorizontal(line), at: shM, a: far }
    }
  }
  if (ankM && metrics.bodyLine && metrics.bodyLine.v < 50) {
    // signed perpendicular offset of hip from the shoulder→ankle line, + = towards the floor
    const L = sub(ankM, shM), l = len(L)
    let nx = -L.y / l, ny = L.x / l
    if (ny < 0) { nx = -nx; ny = -ny }
    const off = (hipM.x - shM.x) * nx + (hipM.y - shM.y) * ny
    metrics.hipSag = { v: (off / l) * 100, at: hipM }
  }
  if (has(27, 28, 11, 12) && view !== 'side') metrics.legsGap = { v: dist(pts[27], pts[28]) / dist(pts[11], pts[12]), at: mid(pts[27], pts[28]) }
  if (has(25, 26) && hipM) metrics.legSplit = { v: angleAt(pts[25], hipM, pts[26]), at: hipM, a: pts[25], c: pts[26] }

  // flag / two-hand points: top vs bottom hand by height
  const armOk = SIDES.filter((s) => has(s.sh, s.el, s.wr))
  if (armOk.length === 2) {
    const [t, b] = pts[armOk[0].wr].y < pts[armOk[1].wr].y ? armOk : [armOk[1], armOk[0]]
    metrics.elbowTop = { v: angleAt(pts[t.sh], pts[t.el], pts[t.wr]), at: pts[t.el], a: pts[t.sh], c: pts[t.wr] }
    metrics.elbowBottom = { v: angleAt(pts[b.sh], pts[b.el], pts[b.wr]), at: pts[b.el], a: pts[b.sh], c: pts[b.wr] }
    Object.assign(named, { shTop: pts[t.sh], wrTop: pts[t.wr], shBot: pts[b.sh], wrBot: pts[b.wr] })
  }
  // lead (punching) arm = wrist farthest from its shoulder relative to arm length
  if (armOk.length) {
    const ext = (s: (typeof SIDES)[number]) => dist(pts[s.sh], pts[s.wr]) / (dist(pts[s.sh], pts[s.el]) + dist(pts[s.el], pts[s.wr]))
    const lead = armOk.reduce((a, b) => (ext(b) > ext(a) ? b : a))
    metrics.elbowLead = { v: angleAt(pts[lead.sh], pts[lead.el], pts[lead.wr]), at: pts[lead.el], a: pts[lead.sh], c: pts[lead.wr] }
    if (pts[lead.hip]) metrics.shoulderLead = { v: angleAt(pts[lead.hip], pts[lead.sh], pts[lead.el]), at: pts[lead.sh], a: pts[lead.hip], c: pts[lead.el] }
    Object.assign(named, { leadSh: pts[lead.sh], leadEl: pts[lead.el], leadWr: pts[lead.wr] })
    const guard = SIDES.find((s) => s !== lead && pts[s.wr])
    if (guard && pts[0]) metrics.guardDist = { v: dist(pts[guard.wr], pts[0]) / torsoLen, at: pts[guard.wr] }
  }
  // kick: the leg whose ankle is higher
  const legOk = SIDES.filter((s) => has(s.hip, s.knee, s.ank))
  if (legOk.length === 2 && !inverted) {
    const [k, b] = pts[legOk[0].ank].y < pts[legOk[1].ank].y ? legOk : [legOk[1], legOk[0]]
    const legLen = dist(pts[k.hip], pts[k.knee]) + dist(pts[k.knee], pts[k.ank])
    metrics.kickHeight = { v: ((pts[k.hip].y - pts[k.ank].y) / legLen) * 100, at: pts[k.ank] }
    metrics.baseKnee = { v: angleAt(pts[b.hip], pts[b.knee], pts[b.ank]), at: pts[b.knee], a: pts[b.hip], c: pts[b.ank] }
    if (pts[k.sh]) metrics.kickHip = { v: angleAt(pts[k.sh], pts[k.hip], pts[k.knee]), at: pts[k.hip], a: pts[k.sh], c: pts[k.knee] }
    Object.assign(named, { kickHip: pts[k.hip], kickKnee: pts[k.knee], kickAnk: pts[k.ank] })
  }
  return { ok: true, W, H, pts, vis, view, front, metrics, named, torsoLen, inverted, z, spread }
}

// ---------- exercise guess from pose geometry ----------
export type Guess = { id: string; sure: boolean }
export function guessExercise(p: Pose): Guess[] {
  if (!p.ok || !p.named.shM || !p.named.hipM) return []
  const m = p.metrics, n = p.named, P = p.pts, T = p.torsoLen
  const out: Guess[] = []
  const wrists = [P[15], P[16]].filter(Boolean)
  const bothWr = P[15] && P[16]
  const vertStack = bothWr && Math.abs(P[15].x - P[16].x) < 0.5 * Math.abs(P[15].y - P[16].y) && Math.abs(P[15].y - P[16].y) > 0.6 * T
  const torsoH = vsHorizontal(sub(n.shM, n.hipM))
  const line = m.bodyLine?.v ?? torsoH
  const wrAboveSh = wrists.length > 0 && wrists.every((w) => w.y < n.shM.y - 0.25 * T)
  const wrBelowSh = wrists.length > 0 && wrists.every((w) => w.y > n.shM.y)
  const nose = P[0]
  const wrM = n.wrM

  // both hands stacked on a vertical pole with the body held out to the side = flag family
  const awayFromPole = wrM && Math.abs(n.hipM.x - wrM.x) > 0.6 * T
  if (vertStack && awayFromPole) {
    const tuck = m.knee && m.knee.v < 120
    if (torsoH < 60) out.push({ id: tuck ? 'human-flag-progression' : 'full-human-flag', sure: true })
    else out.push({ id: 'vertical-flag', sure: false }, { id: tuck ? 'human-flag-progression' : 'full-human-flag', sure: false })
    out.push({ id: tuck ? 'full-human-flag' : 'human-flag-progression', sure: false }, { id: 'straddle-human-flag', sure: false })
    if (!out.some((g) => g.id === 'vertical-flag')) out.push({ id: 'vertical-flag', sure: false })
    return out
  }
  if (p.inverted) {
    const headLow = nose && wrists.length > 0 && wrists.every((w) => nose.y > w.y - 0.15 * T)
    if (headLow) out.push({ id: 'headstand', sure: true }, { id: 'freestanding-handstand', sure: false })
    else if (wrists.length && m.elbowMin && m.elbowMin.v > 140) out.push({ id: 'freestanding-handstand', sure: true }, { id: 'headstand', sure: false })
    else out.push({ id: 'headstand', sure: false }, { id: 'freestanding-handstand', sure: false })
    return out
  }
  // hip thrust: shoulders (on the bench) about level with the knees, hips at/below knee height, feet planted below
  if (m.knee && n.kneeM && n.ankM && Math.abs(n.shM.y - n.kneeM.y) < 0.5 * T && n.hipM.y > n.kneeM.y - 0.1 * T && n.ankM.y > n.kneeM.y + 0.4 * T && torsoH < 60) {
    out.push({ id: 'hip-thrust', sure: true }, { id: 'push-up', sure: false })
    return out
  }
  if (line < 30 && torsoH < 40) {
    if (wrAboveSh) out.push({ id: 'full-front-lever', sure: true }, { id: 'tuck-front-lever', sure: false })
    else if (wrBelowSh && m.elbow && m.elbow.v < 120 && P[13] && P[15] && Math.abs(P[13].y - P[15].y) < 0.2 * T) out.push({ id: 'plank', sure: true }, { id: 'push-up', sure: false })
    else out.push({ id: 'push-up', sure: true }, { id: 'plank', sure: false })
    return out
  }
  // upright-ish with the hands overhead (works without a visible face — back views have no nose)
  const wrAboveHead = wrists.length > 0 && (nose ? wrists.every((w) => w.y < nose.y) : false)
  const armsOverhead = wrAboveHead || (wrists.length > 0 && wrists.every((w) => w.y < n.shM.y - 0.2 * T))
  if (armsOverhead) {
    // seated = hips flexed (thighs forward); a pulldown/press machine seat, not a split
    const thighsLevel = n.kneeM ? Math.abs(n.kneeM.y - n.hipM.y) < 0.5 * T : false
    const seated = !!m.hip && m.hip.v < 130 && (thighsLevel || !m.knee || m.knee.v < 150 || m.hip.v < 125)
    if (seated && p.view === 'back') out.push({ id: 'lat-pulldown', sure: true }, { id: 'overhead-press', sure: false }, { id: 'pull-up', sure: false })
    else if (seated) out.push({ id: 'overhead-press', sure: true }, { id: 'lat-pulldown', sure: false }, { id: 'pull-up', sure: false })
    else out.push({ id: 'pull-up', sure: false }, { id: 'overhead-press', sure: false }, { id: 'lat-pulldown', sure: false })
    return out
  }
  if (m.kickHeight && m.kickHeight.v > -20 && m.baseKnee && m.baseKnee.v > 140) {
    out.push({ id: 'front-kick', sure: false }, { id: 'roundhouse-kick', sure: false }, { id: 'side-kick', sure: false })
    return out
  }
  if (m.legSplit && m.legSplit.v > 120) {
    out.push({ id: 'front-split', sure: false }, { id: 'middle-split', sure: false })
    return out
  }
  if (m.knee && m.knee.v < 140 && m.hip && m.hip.v < 140) {
    const asym = m.kneeMin && P[27] && P[28] && Math.abs(P[27].x - P[28].x) > 0.9 * T
    if (asym) out.push({ id: 'forward-lunge', sure: false }, { id: 'bulgarian-split-squat', sure: false }, { id: 'back-squat', sure: false })
    else out.push({ id: 'back-squat', sure: true }, { id: 'bodyweight-squat', sure: false }, { id: 'goblet-squat', sure: false })
    return out
  }
  if (m.trunkLean.v > 30 && m.trunkLean.v < 100 && (!m.knee || m.knee.v >= 140)) {
    out.push({ id: 'romanian-deadlift', sure: true }, { id: 'deadlift', sure: false }, { id: 'standing-hamstring-stretch', sure: false })
    return out
  }
  if (m.elbowLead && m.elbowLead.v > 150 && m.shoulderLead && m.shoulderLead.v > 60 && m.shoulderLead.v < 120) {
    out.push({ id: 'boxing-jab', sure: false }, { id: 'boxing-cross', sure: false })
    return out
  }
  // standing tall — could be the top of many lifts: ask
  out.push({ id: 'deadlift', sure: false }, { id: 'back-squat', sure: false }, { id: 'overhead-press', sure: false })
  return out
}

// ---------- rules ----------
export type CheckResult = { metric: string; label: string; value: string; status: Status; msg: string }
const fmt = (metric: string, v: number) => (metric === 'hipSag' || metric === 'kickHeight' ? `${Math.round(v)}%` : metric === 'legsGap' || metric === 'guardDist' ? v.toFixed(2) : `${Math.round(v)}°`)
const inR = (v: number, r: [number, number]) => v >= r[0] && v < r[1]

export function evaluateRules(p: Pose, exId: string | undefined, lang: Lang): { checks: CheckResult[]; skipped: string[] } {
  const { profile } = exerciseSetup(exId)
  const checks: CheckResult[] = []
  const skipped: string[] = []
  for (const c of profile.checks) {
    if (exId && c.skipFor?.includes(exId)) continue
    if (c.onlyIfMissing && p.metrics[c.onlyIfMissing]) continue
    const m = p.metrics[c.metric]
    const label = l3(LABELS[c.metric], lang)
    if (!m) { if (!profile.checks.some((o) => o.onlyIfMissing === c.metric)) skipped.push(label); continue }
    if (c.when && !Object.entries(c.when).every(([k, r]) => p.metrics[k] && inR(p.metrics[k].v, r))) continue
    const band = c.bands.find((b) => inR(m.v, b.r))
    if (!band) continue
    const shown = c.metric === 'hipSag' || c.metric === 'kickHeight' ? Math.round(Math.abs(m.v)) : Math.round(m.v)
    checks.push({ metric: c.metric, label, value: fmt(c.metric, m.v), status: band.s, msg: l3(band, lang).replaceAll('{v}', String(shown)) })
  }
  // generic: list measured angles as plain facts (no judgement)
  if (!profile.checks.length) {
    for (const k of ['knee', 'hip', 'elbow', 'shoulder', 'trunkLean']) {
      const m = p.metrics[k]
      if (!m) continue
      checks.push({ metric: k, label: l3(LABELS[k], lang), value: fmt(k, m.v), status: 'info', msg: '' })
    }
  }
  return { checks, skipped }
}

export const metricLabel = (k: string, lang: Lang) => l3(LABELS[k], lang)

/** 1–3 headline insights: fixes first, then warnings, then positives. */
export function insights(checks: CheckResult[]): CheckResult[] {
  const order: Status[] = ['fix', 'warn', 'ok', 'info']
  return [...checks].filter((c) => c.msg).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)).slice(0, 3)
}
