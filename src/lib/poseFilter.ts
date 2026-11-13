/**
 * Pure, dependency-free pose reliability filtering + label layout.
 * Rule: never draw or report a joint/angle we cannot actually see. MediaPipe will
 * happily "predict" knees and hips that are out of frame — we reject those here.
 */

export type Pt = { x: number; y: number; z?: number; visibility?: number; presence?: number }
export type JointName = 'knee' | 'hip' | 'elbow'
export type JointAngle = { name: JointName; deg: number; at: Pt }

export const MIN_CONF = 0.65
export const EDGE_MARGIN = 0.02

// MediaPipe indices
export const L = { sh: 11, el: 13, wr: 15, hip: 23, knee: 25, ank: 27 }
export const R = { sh: 12, el: 14, wr: 16, hip: 24, knee: 26, ank: 28 }
type Side = typeof L
const NOSE = 0

/** Confidence = the lower of visibility / presence. Missing both ⇒ 0 (never assume). */
export function conf(p?: Pt): number {
  if (!p) return 0
  const v = typeof p.visibility === 'number' ? p.visibility : undefined
  const pr = typeof p.presence === 'number' ? p.presence : undefined
  if (v === undefined && pr === undefined) return 0
  return Math.min(v ?? 1, pr ?? 1)
}

export function inFrame(p?: Pt, margin = EDGE_MARGIN): boolean {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= margin && p.x <= 1 - margin && p.y >= margin && p.y <= 1 - margin
}

export function reliable(p?: Pt, min = MIN_CONF): boolean {
  return conf(p) >= min && inFrame(p)
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Angle ABC in degrees (B is the vertex). */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const ab = Math.atan2(a.y - b.y, a.x - b.x)
  const cb = Math.atan2(c.y - b.y, c.x - b.x)
  let deg = Math.abs(((ab - cb) * 180) / Math.PI)
  if (deg > 180) deg = 360 - deg
  return deg
}

/** Is P lying on segment A→B (between 10% and 100% along it, within `tol`×|AB| of the line)? */
function onSegment(p: Pt, a: Pt, b: Pt, tol: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return false
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)
  const perp = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
  return t > 0.1 && t < 1 && perp < tol * len
}

const ratioOk = (a: number, b: number, max = 3) => a > 0 && b > 0 && a / b <= max && b / a <= max

/**
 * Whole-pose sanity check. Returns false when the reliable landmarks describe a body
 * that cannot exist (knee inside torso/head, absurd limb proportions, collapsed box).
 */
export function plausiblePose(lm: Pt[]): boolean {
  const idx = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].filter((i) => reliable(lm[i]))
  if (idx.length < 3) return false
  const xs = idx.map((i) => lm[i].x)
  const ys = idx.map((i) => lm[i].y)
  const bw = Math.max(...xs) - Math.min(...xs)
  const bh = Math.max(...ys) - Math.min(...ys)
  if (Math.max(bw, bh) < 0.08) return false // all "joints" piled into a tiny blob

  for (const s of [L, R]) {
    const sh = lm[s.sh], hip = lm[s.hip], knee = lm[s.knee], ank = lm[s.ank], el = lm[s.el], wr = lm[s.wr]
    const hasTorso = reliable(sh) && reliable(hip)
    const torso = hasTorso ? dist(sh, hip) : 0
    if (hasTorso && torso < 0.03) return false
    if (reliable(knee)) {
      if (hasTorso) {
        // knee sitting on the torso / chest — e.g. arm close-up where MediaPipe guesses legs
        if (dist(knee, hip) < 0.35 * torso) return false
        if (dist(knee, sh) < 0.35 * torso) return false
        if (onSegment(knee, hip, sh, 0.35)) return false
        if (!ratioOk(dist(hip, knee), torso)) return false
      }
      if (reliable(lm[NOSE]) && hasTorso && dist(knee, lm[NOSE]) < 0.4 * torso) return false
      if (reliable(hip) && reliable(ank) && !ratioOk(dist(knee, ank), dist(hip, knee))) return false
    }
    if (reliable(hip) && reliable(lm[NOSE]) && hasTorso && dist(hip, lm[NOSE]) < 0.5 * torso) return false
    if (reliable(sh) && reliable(el) && reliable(wr) && !ratioOk(dist(sh, el), dist(el, wr))) return false
  }
  return true
}

/** Lower body is only trusted when at least one hip is reliably in frame. */
export function lowerBodyVisible(lm: Pt[]): boolean {
  return reliable(lm[L.hip]) || reliable(lm[R.hip])
}

const triplets = (s: Side): { name: JointName; ids: [number, number, number]; lower: boolean }[] => [
  { name: 'knee', ids: [s.hip, s.knee, s.ank], lower: true },
  { name: 'hip', ids: [s.sh, s.hip, s.knee], lower: true },
  { name: 'elbow', ids: [s.sh, s.el, s.wr], lower: false },
]

export type PoseResult = {
  /** pose passed the plausibility check */
  ok: boolean
  /** landmark indices safe to draw */
  points: number[]
  /** angles safe to show (empty when fewer than MIN_JOINTS pass) */
  angles: JointAngle[]
  /** true when we refused to show angles */
  notMeasurable: boolean
}

export const MIN_JOINTS = 2
const DRAWN = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

export function evaluatePose(lm: Pt[] | null | undefined): PoseResult {
  if (!lm || lm.length < 29 || !plausiblePose(lm)) return { ok: false, points: [], angles: [], notMeasurable: true }
  const lower = lowerBodyVisible(lm)
  const points = DRAWN.filter((i) => reliable(lm[i]) && (lower || i < 23))
  const found: (JointAngle & { score: number })[] = []
  for (const s of [L, R]) {
    for (const tr of triplets(s)) {
      if (tr.lower && !lower) continue
      const [a, b, c] = tr.ids.map((i) => lm[i])
      if (![a, b, c].every((p) => reliable(p))) continue
      const score = Math.min(conf(a), conf(b), conf(c))
      const prev = found.find((f) => f.name === tr.name)
      const item = { name: tr.name, deg: angle(a, b, c), at: b, score }
      if (!prev) found.push(item)
      else if (score > prev.score) found.splice(found.indexOf(prev), 1, item)
    }
  }
  const order: JointName[] = ['knee', 'hip', 'elbow']
  const angles = found.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)).map(({ name, deg, at }) => ({ name, deg, at }))
  if (angles.length < MIN_JOINTS) return { ok: true, points, angles: [], notMeasurable: true }
  return { ok: true, points, angles, notMeasurable: false }
}

export type Rect = { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap

/**
 * Place label boxes next to their anchors, inside [pad, W-pad]×[pad, H-pad],
 * never overlapping each other. Labels that cannot be placed are dropped (null).
 */
export function layoutLabels(items: { x: number; y: number; w: number; h: number }[], W: number, H: number, pad = 4, gap = 4): (Rect | null)[] {
  const placed: Rect[] = []
  return items.map(({ x, y, w, h }) => {
    if (w > W - 2 * pad || h > H - 2 * pad) return null
    const off = h * 0.7
    const clamp = (r: Rect): Rect => ({ ...r, x: Math.min(W - pad - w, Math.max(pad, r.x)), y: Math.min(H - pad - h, Math.max(pad, r.y)) })
    const base = [
      { x: x + off, y: y - h / 2 }, { x: x - off - w, y: y - h / 2 },
      { x: x - w / 2, y: y - off - h }, { x: x - w / 2, y: y + off },
    ]
    for (const step of [0, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6]) {
      for (const b of base) {
        const r = clamp({ x: b.x, y: b.y + step * (h + gap), w, h })
        if (!placed.some((p) => overlaps(p, r, gap))) {
          placed.push(r)
          return r
        }
      }
    }
    return null
  })
}
