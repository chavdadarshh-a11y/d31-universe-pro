/**
 * Muscle ARTWORK v2 — anatomical drawings fitted to the photo (front + back views).
 * PURE module (no DOM) so it runs in node tests and the review-sheet generator.
 *
 * Every muscle (or muscle part / head / strand) is a Coons patch bounded by 4 anatomical curves:
 *   O = origin line, I = insertion line, A = side border O[0]→I[0], B = side border O[end]→I[end].
 * Fibres are the patch's iso-lines from origin to insertion, so outline and fibre direction come from the
 * same anatomy. Trunk art lives in a canonical torso frame (left half authored, right half mirrored) and is
 * bent onto the photo with a thin-plate spline through joint + body-outline anchors (C7/notch, neck,
 * acromion, shoulders, armpits, flank, waist, iliac crest, sacrum/pubis, hips). Limb art lives in a
 * bone frame (joint→joint) whose width comes from the person mask.
 * A muscle that is not visible from the view, whose anchors cannot be measured, or that lands outside the
 * body is NOT drawn.
 */
import type { P, Pose } from './formCheck'
import type { DrawnMuscle, Fine, Mask, NotDrawn, Role } from './muscleAnatomy'

type V2 = [number, number]
type Frame = 'trunk' | 'upperArm' | 'forearm' | 'thigh'
export type ArtPart = { O: V2[]; I: V2[]; A: V2[]; B: V2[]; frame: Frame; unit?: 'T' | 'bone'; apo?: boolean; bands?: number[]; nf?: number; minArm?: number; shade?: number }
export type ArtMuscle = { id: Fine; view: 'front' | 'back'; parts: Record<string, ArtPart>; layer: number; polyLeft?: V2[] }

// ---------------- the drawings ----------------
const T = (O: V2[], I: V2[], A: V2[], B: V2[], x: Partial<ArtPart> = {}): ArtPart => ({ O, I, A, B, frame: 'trunk', ...x })
const L = (frame: Frame, unit: 'T' | 'bone', O: V2[], I: V2[], A: V2[], B: V2[], x: Partial<ArtPart> = {}): ArtPart => ({ O, I, A, B, frame, unit, ...x })

/** BACK view, canonical units = px of the reference lat-pulldown photo, C7 = (0,0), image-left half (x<0) */
const BACK: ArtMuscle[] = [
  { id: 'erectors', view: 'back', layer: 0, parts: {
    // spinalis — narrow, next to the spinous processes, thoracic
    spinalis: T([[-2, 156], [-6, 155], [-9, 150]], [[-2, 10], [-3.5, 11], [-5, 13]], [[-2, 156], [-2, 80], [-2, 10]], [[-9, 150], [-10, 132], [-8, 116], [-8.5, 96], [-7, 76], [-7, 52], [-5, 13]], { nf: 4 }),
    // longissimus — the main column, thick in the lumbar region
    longissimus: T([[-5, 196], [-12, 196], [-19, 193]], [[-6, 14], [-9, 15], [-12, 18]], [[-5, 196], [-6, 150], [-8, 100], [-7.5, 50], [-6, 14]], [[-19, 193], [-22, 170], [-21, 140], [-17, 100], [-14, 55], [-12, 18]], { nf: 7 }),
    // iliocostalis — lateral strand, from the iliac crest up to the ribs, fibres angle up-and-out
    iliocostalis: T([[-19, 192], [-25, 189], [-30, 184]], [[-14, 40], [-18, 42], [-22, 46]], [[-19, 192], [-22, 170], [-21, 140], [-17, 100], [-14, 40]], [[-30, 184], [-34, 165], [-34, 140], [-30, 108], [-26, 76], [-22, 46]], { nf: 6 }),
  } },
  { id: 'rhomboids', view: 'back', layer: 1, parts: {
    rh: T([[-1, -2], [-1, 30], [-1, 62]], [[-29, 11], [-42, 40], [-56, 72]], [[-1, -2], [-14, 2], [-29, 11]], [[-1, 62], [-28, 70], [-56, 72]], { nf: 12 }),
  } },
  { id: 'infraspinatus', view: 'back', layer: 2, parts: {
    inf: T([[-34, 27], [-37, 40], [-43, 54], [-50, 65], [-58, 73]], [[-86, 20], [-90, 28]], [[-34, 27], [-50, 22], [-68, 18], [-86, 20]], [[-58, 73], [-71, 70], [-82, 58], [-89, 43], [-90, 28]], { nf: 13 }),
  } },
  { id: 'teres_major', view: 'back', layer: 3, parts: {
    // thick rounded band: broad on the scapula tip, tapering into the armpit
    tm: T([[-44, 90], [-47, 78], [-53, 66], [-59, 58]], [[-91, 61], [-94, 55], [-95, 49]], [[-44, 90], [-56, 93], [-70, 87], [-83, 74], [-91, 61]], [[-59, 58], [-70, 53], [-83, 50], [-95, 49]], { nf: 9 }),
  } },
  { id: 'lats', view: 'back', layer: 4, parts: {
    lat: T(
      [[-2, 62], [-4, 86], [-11, 110], [-24, 136], [-40, 160], [-54, 180], [-63, 184], [-67, 168], [-66, 150]],
      [[-90, 49], [-94, 55], [-97, 62]],
      [[-2, 62], [-22, 68], [-42, 74], [-58, 79], [-72, 71], [-83, 60], [-90, 49]],
      [[-66, 150], [-70, 124], [-77, 100], [-85, 80], [-92, 68], [-97, 62]], { nf: 16 }),
  },
    // thoracolumbar aponeurosis (tendon sheet of the lats) — one bilateral sheet, left half given top → bottom centre
    polyLeft: [[0, 86], [-4, 86], [-11, 110], [-24, 136], [-40, 160], [-54, 180], [-34, 190], [0, 194]] },
  { id: 'traps_mid', view: 'back', layer: 5, parts: {
    // lower trapezius: T4–T12 → root of the scapular spine (curved wedge with a blunt aponeurotic tip)
    lower: T([[0, 39], [0, 82], [0, 120], [-1, 126]], [[-40, 25], [-38, 29], [-35, 34]], [[0, 39], [-14, 43], [-29, 38], [-40, 25]], [[-1, 126], [-6, 122], [-13, 108], [-22, 87], [-30, 64], [-35, 46], [-35, 34]], { nf: 13 }),
    // middle trapezius: C7–T3 → acromion + scapular spine, horizontal fibres, convex lower edge
    middle: T([[0, -2], [0, 18], [0, 39]], [[-95, 6], [-82, 15], [-62, 23], [-40, 25]], [[0, -2], [-30, 0], [-62, 3], [-95, 6]], [[0, 39], [-14, 43], [-29, 38], [-40, 25]], { nf: 12 }),
  } },
  { id: 'traps_upper', view: 'back', layer: 6, parts: {
    up: T([[0, -40], [0, -20], [0, -2]], [[-62, -15], [-80, -7], [-91, 0], [-95, 6]], [[0, -40], [-13, -39], [-28, -35], [-45, -26], [-62, -15]], [[0, -2], [-30, 0], [-62, 3], [-95, 6]], { nf: 11 }),
  } },
  { id: 'triceps', view: 'back', layer: 7, parts: {
    tendon: L('upperArm', 'bone', [[0.83, 0.45], [0.78, 0.03], [0.81, -0.45]], [[0.99, 0.1], [1.0, 0], [0.99, -0.1]], [[0.83, 0.45], [0.92, 0.3], [0.99, 0.1]], [[0.81, -0.45], [0.92, -0.3], [0.99, -0.1]], { apo: true, minArm: 0.36 }),
    long: L('upperArm', 'bone', [[0.12, 0.4], [0.16, 0.85]], [[0.79, 0.06], [0.83, 0.45]], [[0.12, 0.4], [0.4, 0.3], [0.62, 0.16], [0.79, 0.06]], [[0.16, 0.85], [0.42, 0.97], [0.66, 0.82], [0.83, 0.45]], { minArm: 0.36, nf: 9 }),
    lateral: L('upperArm', 'bone', [[0.3, -0.1], [0.34, -0.8]], [[0.77, 0], [0.81, -0.45]], [[0.3, -0.1], [0.55, -0.05], [0.77, 0]], [[0.34, -0.8], [0.56, -0.92], [0.72, -0.74], [0.81, -0.45]], { minArm: 0.36, nf: 8 }),
  } },
  { id: 'delt_post', view: 'back', layer: 8, parts: {
    // posterior deltoid fan: broad origin along the scapular spine → narrow insertion at the deltoid tuberosity
    pd: L('upperArm', 'T', [[-0.08, 0.42], [-0.07, 0.0], [-0.04, -0.5], [0.0, -0.98]], [[0.31, -0.3], [0.33, -0.4]], [[-0.08, 0.42], [0.04, 0.5], [0.16, 0.36], [0.25, 0.04], [0.31, -0.3]], [[0.0, -0.98], [0.1, -1.04], [0.21, -0.9], [0.29, -0.64], [0.33, -0.4]], { nf: 12, minArm: 0.15 }),
  } },
]

/** FRONT view, same canonical frame: (0,0) = suprasternal notch level, image-left half (x<0) */
const FRONT: ArtMuscle[] = [
  { id: 'serratus', view: 'front', layer: 0, parts: Object.fromEntries([0, 1, 2, 3].map((k) => [`slip${k}`, T(
    [[-61 - 2 * k, 84 + 12 * k], [-63 - 2 * k, 90 + 12 * k]], [[-85 + k, 70 + 11 * k], [-87 + k, 79 + 11 * k]],
    [[-61 - 2 * k, 84 + 12 * k], [-70 - k, 79 + 12 * k], [-78, 74 + 11.5 * k], [-85 + k, 70 + 11 * k]],
    [[-63 - 2 * k, 90 + 12 * k], [-72 - k, 88 + 11.5 * k], [-80, 83 + 11 * k], [-87 + k, 79 + 11 * k]], { nf: 3 })])) },
  { id: 'obliques', view: 'front', layer: 1, parts: {
    ext: T([[-64, 96], [-70, 112], [-72, 130], [-70, 148]], [[-30, 100], [-29, 125], [-32, 150], [-44, 170], [-60, 186]], [[-64, 96], [-48, 95], [-30, 100]], [[-70, 148], [-68, 168], [-60, 186]], { nf: 14 }),
  } },
  { id: 'rectus_abdominis', view: 'front', layer: 2, parts: {
    // one strap per side, pubis → ribs, with the three tendinous intersections drawn as bands
    ra: T([[-3, 214], [-7, 215], [-11, 212]], [[-3, 80], [-16, 77], [-29, 82]], [[-3, 214], [-3, 150], [-3, 80]], [[-11, 212], [-20, 192], [-26, 165], [-28, 135], [-29, 105], [-29, 82]], { nf: 6, bands: [0.45, 0.65, 0.83] }),
  } },
  { id: 'pec_major', view: 'front', layer: 3, parts: {
    sternal: T([[-10, 13], [-3, 30], [-3, 58], [-6, 80], [-14, 90]], [[-86, 46], [-90, 54], [-91, 62]], [[-10, 13], [-36, 22], [-62, 33], [-86, 46]], [[-14, 90], [-34, 95], [-56, 91], [-74, 81], [-86, 70], [-91, 62]], { nf: 16 }),
    clavicular: T([[-5, 4], [-22, 1], [-42, 3]], [[-86, 44], [-84, 36]], [[-5, 4], [-10, 13], [-36, 22], [-62, 33], [-86, 44]], [[-42, 3], [-58, 10], [-74, 22], [-84, 36]], { nf: 10 }),
  } },
  { id: 'brachialis', view: 'front', layer: 4, parts: {
    br: L('upperArm', 'bone', [[0.45, -0.72], [0.42, -1.0]], [[0.98, -0.22], [0.98, -0.45]], [[0.45, -0.72], [0.7, -0.64], [0.88, -0.4], [0.98, -0.22]], [[0.42, -1.0], [0.7, -1.02], [0.9, -0.76], [0.98, -0.45]], { minArm: 0.36, nf: 6 }),
  } },
  { id: 'biceps', view: 'front', layer: 5, parts: {
    tendon: L('upperArm', 'bone', [[0.86, -0.22], [0.84, 0.0], [0.86, 0.24]], [[1.0, -0.07], [1.0, 0.07]], [[0.86, -0.22], [0.94, -0.12], [1.0, -0.07]], [[0.86, 0.24], [0.94, 0.12], [1.0, 0.07]], { apo: true, minArm: 0.36 }),
    // two heads with the groove between them (long head lateral, short head medial)
    long: L('upperArm', 'bone', [[0.1, -0.2], [0.12, 0.05]], [[0.86, -0.22], [0.84, 0.0]], [[0.1, -0.2], [0.3, -0.5], [0.55, -0.7], [0.75, -0.5], [0.86, -0.22]], [[0.12, 0.05], [0.4, 0.08], [0.62, 0.05], [0.84, 0.0]], { minArm: 0.36, nf: 7 }),
    short: L('upperArm', 'bone', [[0.12, 0.05], [0.12, 0.3]], [[0.84, 0.0], [0.86, 0.24]], [[0.12, 0.05], [0.4, 0.08], [0.62, 0.05], [0.84, 0.0]], [[0.12, 0.3], [0.3, 0.55], [0.52, 0.72], [0.72, 0.55], [0.86, 0.24]], { minArm: 0.36, nf: 6 }),
  } },
  { id: 'forearm_flexors', view: 'front', layer: 6, parts: {
    fl: L('forearm', 'bone', [[-0.02, 0.2], [0.04, 0.9]], [[0.86, 0.05], [0.9, 0.42]], [[-0.02, 0.2], [0.3, 0.05], [0.6, 0.0], [0.86, 0.05]], [[0.04, 0.9], [0.3, 1.0], [0.6, 0.8], [0.9, 0.42]], { minArm: 0.3, nf: 9 }),
  } },
  { id: 'delt_ant', view: 'front', layer: 7, parts: {
    ad: L('upperArm', 'T', [[-0.08, 0.72], [-0.09, 0.3], [-0.07, -0.3]], [[0.26, 0.22], [0.3, -0.05], [0.29, -0.3]], [[-0.08, 0.72], [0.04, 0.7], [0.12, 0.56], [0.2, 0.42], [0.26, 0.22]], [[-0.07, -0.3], [0.04, -0.36], [0.17, -0.42], [0.29, -0.3]], { minArm: 0.15, nf: 10 }),
  } },
  { id: 'delt_lat', view: 'front', layer: 8, parts: {
    ld: L('upperArm', 'T', [[-0.07, -0.3], [-0.04, -0.75], [0.0, -1.05]], [[0.29, -0.3], [0.31, -0.6]], [[-0.07, -0.3], [0.04, -0.36], [0.17, -0.42], [0.29, -0.3]], [[0.0, -1.05], [0.12, -1.12], [0.24, -0.92], [0.31, -0.6]], { minArm: 0.15, nf: 9 }),
  } },
  { id: 'adductors', view: 'front', layer: 9, parts: {
    ad: L('thigh', 'bone', [[0.0, -0.4], [0.02, -0.95]], [[0.55, -0.6], [0.6, -0.86]], [[0.0, -0.4], [0.2, -0.42], [0.4, -0.5], [0.55, -0.6]], [[0.02, -0.95], [0.25, -1.0], [0.45, -0.96], [0.6, -0.86]], { minArm: 0.45, nf: 8 }),
  } },
  { id: 'vastus_medialis', view: 'front', layer: 10, parts: {
    vm: L('thigh', 'bone', [[0.5, -0.42], [0.45, -0.85]], [[0.95, -0.15], [0.93, -0.4]], [[0.5, -0.42], [0.7, -0.36], [0.85, -0.26], [0.95, -0.15]], [[0.45, -0.85], [0.7, -1.0], [0.86, -0.82], [0.93, -0.4]], { minArm: 0.45, nf: 7 }),
  } },
  { id: 'vastus_lateralis', view: 'front', layer: 11, parts: {
    vl: L('thigh', 'bone', [[0.12, 0.4], [0.1, 0.95]], [[0.95, 0.18], [0.92, 0.45]], [[0.12, 0.4], [0.4, 0.4], [0.7, 0.28], [0.95, 0.18]], [[0.1, 0.95], [0.4, 1.02], [0.7, 0.92], [0.92, 0.45]], { minArm: 0.45, nf: 9 }),
  } },
  { id: 'rectus_femoris', view: 'front', layer: 12, parts: {
    rf: L('thigh', 'bone', [[0.06, -0.12], [0.05, 0.0], [0.06, 0.12]], [[0.94, -0.1], [0.94, 0.1]], [[0.06, -0.12], [0.24, -0.34], [0.46, -0.4], [0.72, -0.26], [0.94, -0.1]], [[0.06, 0.12], [0.24, 0.36], [0.46, 0.42], [0.72, 0.27], [0.94, 0.1]], { minArm: 0.45, nf: 9 }),
  } },
]
export const ART: ArtMuscle[] = [...BACK, ...FRONT]
export const artCovers = (view: string): Set<Fine> => new Set(ART.filter((m) => m.view === view).map((m) => m.id))

// ---------------- curves + Coons patch ----------------
function catmull(pts: V2[], n = 16): V2[] {
  if (pts.length === 2) return Array.from({ length: n }, (_, i) => [pts[0][0] + (pts[1][0] - pts[0][0]) * (i / (n - 1)), pts[0][1] + (pts[1][1] - pts[0][1]) * (i / (n - 1))])
  const Q: V2[] = [[2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]], ...pts, [2 * pts[pts.length - 1][0] - pts[pts.length - 2][0], 2 * pts[pts.length - 1][1] - pts[pts.length - 2][1]]]
  const out: V2[] = []
  for (let i = 1; i < Q.length - 2; i++) {
    const [p0, p1, p2, p3] = [Q[i - 1], Q[i], Q[i + 1], Q[i + 2]]
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)) as V2)
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
function resample(c: V2[], n: number): V2[] {
  const d = [0]
  for (let i = 1; i < c.length; i++) d.push(d[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]))
  const tot = d[d.length - 1]
  if (!tot) return Array.from({ length: n }, () => [...c[0]] as V2)
  const out: V2[] = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const s = (tot * k) / (n - 1)
    while (j < d.length - 2 && d[j + 1] < s) j++
    const f = (s - d[j]) / (d[j + 1] - d[j] || 1)
    out.push([c[j][0] + (c[j + 1][0] - c[j][0]) * f, c[j][1] + (c[j + 1][1] - c[j][1]) * f])
  }
  return out
}
/** C[u][s] */
export function coons(p: Pick<ArtPart, 'O' | 'I' | 'A' | 'B'>, nu = 34, ns = 30): V2[][] {
  const O = resample(catmull(p.O), nu), I = resample(catmull(p.I), nu), A = resample(catmull(p.A), ns), B = resample(catmull(p.B), ns)
  const P00 = O[0], P10 = O[nu - 1], P01 = I[0], P11 = I[nu - 1]
  const C: V2[][] = []
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1), row: V2[] = []
    for (let j = 0; j < ns; j++) {
      const s = j / (ns - 1)
      row.push([0, 1].map((d) => (1 - s) * O[i][d] + s * I[i][d] + (1 - u) * A[j][d] + u * B[j][d]
        - ((1 - u) * (1 - s) * P00[d] + u * (1 - s) * P10[d] + (1 - u) * s * P01[d] + u * s * P11[d])) as V2)
    }
    C.push(row)
  }
  return C
}
const outlineOf = (C: V2[][]): V2[] => {
  const nu = C.length, ns = C[0].length, out: V2[] = []
  for (let i = 0; i < nu; i++) out.push(C[i][0])
  for (let j = 1; j < ns; j++) out.push(C[nu - 1][j])
  for (let i = nu - 2; i >= 0; i--) out.push(C[i][ns - 1])
  for (let j = ns - 2; j > 0; j--) out.push(C[0][j])
  return out
}
const fibresOf = (C: V2[][], k: number): V2[][] => {
  const nu = C.length, out: V2[][] = []
  for (let f = 1; f <= k; f++) out.push(C[Math.round((f * (nu - 1)) / (k + 1))])
  return out
}
const bandsOf = (C: V2[][], at: number[]): V2[][] => at.map((s) => { const j = Math.round(s * (C[0].length - 1)); return C.map((row) => row[j]) })

// ---------------- thin-plate spline ----------------
function solve(A: number[][], b: number[]): number[] {
  const n = b.length, M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    const d = M[c][c] || 1e-12
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12))
}
export class Tps {
  private src: V2[]; private wx: number[]; private wy: number[]
  constructor(src: V2[], dst: V2[], reg = 1e-3) {
    this.src = src
    const n = src.length, N = n + 3
    const A = Array.from({ length: N }, () => new Array(N).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] = Tps.k(src[i], src[j]) + (i === j ? reg : 0)
      A[i][n] = 1; A[i][n + 1] = src[i][0]; A[i][n + 2] = src[i][1]
      A[n][i] = 1; A[n + 1][i] = src[i][0]; A[n + 2][i] = src[i][1]
    }
    this.wx = solve(A, [...dst.map((d) => d[0]), 0, 0, 0])
    this.wy = solve(A, [...dst.map((d) => d[1]), 0, 0, 0])
  }
  static k(a: V2, b: V2) { const r2 = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / 1e4; return r2 > 0 ? r2 * Math.log(r2) : 0 }
  map(p: V2): P {
    const n = this.src.length
    let x = this.wx[n] + this.wx[n + 1] * p[0] + this.wx[n + 2] * p[1], y = this.wy[n] + this.wy[n + 1] * p[0] + this.wy[n + 2] * p[1]
    for (let i = 0; i < n; i++) { const k = Tps.k(p, this.src[i]); x += this.wx[i] * k; y += this.wy[i] * k }
    return { x, y }
  }
}

// ---------------- anchors from joints + body outline ----------------
const CANON: Record<string, V2> = {
  C7: [0, 0], neck: [0, -50], acro: [-97, 10], sh: [-64, 25], pit: [-94, 52], flank: [-80, 95], waist: [-60, 144],
  crest: [-65, 191], sacrum: [0, 191], hip: [-41, 233], spineMid: [0, 95],
}
export type Anchors = Record<string, P> & { _T: P; _hipsBad?: P }
const inside = (m: Mask, x: number, y: number) => {
  const mx = Math.floor(x * m.sx), my = Math.floor(y * m.sy)
  return mx >= 0 && my >= 0 && mx < m.w && my < m.h && m.data[my * m.w + mx] > 0.5
}
function runAt(m: Mask, W: number, y: number, x0: number): [number, number] | null {
  let x = Math.round(x0)
  if (!inside(m, x, y)) {
    let best = -1
    for (let d = 1; d < W; d++) { if (inside(m, x - d, y)) { best = x - d; break } if (inside(m, x + d, y)) { best = x + d; break } }
    if (best < 0) return null
    x = best
  }
  let l = x, r = x
  while (l > 0 && inside(m, l - 1, y)) l--
  while (r < W - 1 && inside(m, r + 1, y)) r++
  return [l, r]
}
export const anchorDebug: { msg: string }[] = []
export function measureAnchors(pose: Pose, m: Mask): Anchors | null {
  const Pp = pose.pts, W = pose.W
  if (!Pp[11] || !Pp[12] || !Pp[23] || !Pp[24]) return null
  const [sL, sR] = [Pp[11], Pp[12]].sort((a, b) => a.x - b.x)
  const [hL0, hR0] = [Pp[23], Pp[24]].sort((a, b) => a.x - b.x)
  const sh = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 }
  let hp = { x: (hL0.x + hR0.x) / 2, y: (hL0.y + hR0.y) / 2 }
  const hw = Math.hypot(sR.x - sL.x, sR.y - sL.y) / 2
  let Tl = Math.hypot(hp.x - sh.x, hp.y - sh.y)
  // hips implausibly close to / far from the shoulders (MediaPipe on a seated, belted or foreshortened body):
  // take the torso length from the shoulder width (canonical shoulder→hip = 3.25 · half shoulder width) and the
  // axis perpendicular to the shoulder line; the hip landmarks are then not trusted for anything else
  const ratio = Tl / (hw || 1)
  const hipsBad = ratio < 2.6 || ratio > 4.4
  if (hipsBad) {
    Tl = 3.25 * hw
    let d = { x: -(sR.y - sL.y), y: sR.x - sL.x }
    const dn = Math.hypot(d.x, d.y) || 1
    d = { x: d.x / dn, y: d.y / dn }
    if (d.x * (hp.x - sh.x) + d.y * (hp.y - sh.y) < 0) d = { x: -d.x, y: -d.y }
    hp = { x: sh.x + d.x * Tl, y: sh.y + d.y * Tl }
  }
  if (Tl < 20 || hw < 0.15 * Tl) return null
  const spine = (y: number) => sh.x + ((hp.x - sh.x) * (y - sh.y)) / (hp.y - sh.y || 1)
  const ax = { x: (hp.x - sh.x) / Tl, y: (hp.y - sh.y) / Tl }
  // torso-only mask: the arms are cut out (capsules along the bones), so an arm touching the body or raised
  // overhead never becomes part of the "torso outline"
  const caps: [P, P, number][] = []
  for (const [s0, e0, w0] of [[11, 13, 15], [12, 14, 16]]) {
    const S = Pp[s0], E = Pp[e0], Wr = Pp[w0]
    if (S && E) caps.push([{ x: S.x + (E.x - S.x) * 0.3, y: S.y + (E.y - S.y) * 0.3 }, E, 0.08 * Tl])
    if (E && Wr) caps.push([E, Wr, 0.065 * Tl])
  }
  const segD = (p: P, a: P, b: P) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)); return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t) }
  const inT = (x: number, y: number) => inside(m, x, y) && !caps.some(([a, b, r]) => segD({ x, y }, a, b) < r)
  // lateral torso edge on one row: scan inward from 1.7·hw until a solid run of torso starts
  const edgeAt = (y: number, sg: -1 | 1): number | null => {
    const c = spine(y), run = Math.max(3, 0.15 * hw)
    for (let d = 1.7 * hw; d > 0.4 * hw; d -= 1) {
      const x = c + sg * d
      if (!inT(x, y)) continue
      let ok = true
      for (let k = 1; k < run; k += 2) if (!inT(x - sg * k, y)) { ok = false; break }
      if (ok) return x
    }
    return null
  }
  // trace each side top → bottom with continuity (a sudden jump = arm, bench, spread legs → ignored)
  const y0 = sh.y + 0.05 * Tl, y1 = Math.min(pose.H - 2, sh.y + 1.35 * Tl)
  const edges: Record<'L' | 'R', Map<number, number>> = { L: new Map(), R: new Map() }
  for (const [side, sg] of [['L', -1], ['R', 1]] as const) {
    const seedY = Math.round(sh.y + 0.3 * Tl)
    const seed = edgeAt(seedY, sg)
    if (seed === null) return null
    for (const dir of [1, -1]) {
      let prev = seed
      for (let y = seedY; dir > 0 ? y <= y1 : y >= y0; y += dir) {
        const e = edgeAt(y, sg)
        if (e !== null && Math.abs(e - prev) <= Math.max(2, 0.025 * Tl)) prev = e
        else if (e !== null) prev += Math.sign(e - prev) * 0.5 // drift slowly toward a persistent change
        edges[side].set(y, prev)
      }
    }
  }
  const keys = [...edges.L.keys()], kLo = Math.min(...keys), kHi = Math.max(...keys)
  const edge = (side: 'L' | 'R', y: number) => edges[side].get(Math.max(kLo, Math.min(kHi, Math.round(y))))!
  const A: Record<string, P> = {}
  A.C7 = { x: sh.x - ax.x * 0.12 * Tl, y: sh.y - ax.y * 0.12 * Tl }
  // armpit level from body proportion (shoulder → hip), position from the traced outline
  const pitY = sh.y + 0.13 * (hp.y - sh.y) + 0.04 * Tl
  A.pitL = { x: edge('L', pitY), y: pitY }; A.pitR = { x: edge('R', pitY), y: pitY }
  // waist = narrowest traced row below the armpits
  let best: [number, number, number] | null = null
  for (let y = pitY + 0.35 * Tl; y < Math.min(y1, pitY + 0.95 * Tl); y += 1) {
    const l = edge('L', y), r = edge('R', y)
    if (r - l > 0.8 * hw && (!best || r - l < best[1] - best[0])) best = [l, r, y]
  }
  if (!best) return null
  A.waistL = { x: best[0], y: best[2] }; A.waistR = { x: best[1], y: best[2] }
  // pelvis: iliac crest sits ~half the armpit→waist distance below the waist (body proportion); never above
  // the hip landmarks' own estimate minus 0.2T (MediaPipe often puts the hips too high)
  const crestY = Math.min(y1, Math.max(best[2] + 0.5 * (best[2] - pitY), Math.min(hp.y - 0.2 * Tl, best[2] + 0.8 * (best[2] - pitY))))
  A.crestL = { x: edge('L', crestY), y: crestY }; A.crestR = { x: edge('R', crestY), y: crestY }
  A.sacrum = { x: spine(crestY), y: crestY }
  const hipY = Math.max(hp.y, crestY + 0.18 * Tl)
  if (hipsBad) { A.hipL = { x: spine(hipY) - 0.64 * hw, y: hipY }; A.hipR = { x: spine(hipY) + 0.64 * hw, y: hipY } }
  else { A.hipL = { x: hL0.x, y: hipY + (hL0.y - hp.y) }; A.hipR = { x: hR0.x, y: hipY + (hR0.y - hp.y) } }
  // neck: narrowest row of the outline between head and shoulders
  let nk: [number, number] | null = null
  for (let y = A.C7.y - 0.05 * Tl; y > A.C7.y - 0.45 * Tl && y > 1; y -= 1) {
    const rr = runAt(m, W, y, spine(y))
    if (rr && (!nk || rr[1] - rr[0] < nk[1])) nk = [y, rr[1] - rr[0]]
  }
  const neckY = nk && nk[1] < 1.3 * hw ? nk[0] : A.C7.y - 0.2 * Tl
  A.neck = { x: spine(neckY), y: Math.min(neckY, A.C7.y - 0.08 * Tl) }
  const kf = (CANON.flank[1] - CANON.pit[1]) / (CANON.waist[1] - CANON.pit[1])
  for (const [side, s, sg] of [['L', sL, -1], ['R', sR, 1]] as const) {
    A['s' + side] = s
    A['acro' + side] = { x: s.x + sg * 0.5 * hw, y: s.y - 0.06 * Tl }
    const y = pitY + kf * (best[2] - pitY)
    A['flank' + side] = { x: edge(side, y), y }
  }
  // repair: a traced point that is implausibly narrow/wide (belt, bench, hanging strap, mask hole) is replaced by
  // the mirrored other side, or else by the body proportion of the measured armpit width (canonical ratios)
  const dl0 = (p: P) => Math.abs(p.x - spine(p.y)) / hw
  const good = (p: P) => Number.isFinite(p.x) && dl0(p) >= 0.5 && dl0(p) <= 1.65
  const pitHalf = [A.pitL, A.pitR].filter(good).map(dl0)
  const pitRef = pitHalf.length ? pitHalf.reduce((a, b) => a + b, 0) / pitHalf.length : CANON.pit[0] / CANON.sh[0]
  let repaired = 0
  for (const key of ['pit', 'flank', 'waist', 'crest']) {
    const ratio = (CANON[key][0] / CANON.pit[0]) * pitRef
    for (const [side, other, sg] of [['L', 'R', -1], ['R', 'L', 1]] as const) {
      const p = A[key + side], o = A[key + other]
      if (good(p)) continue
      repaired++
      const d = good(o) ? dl0(o) : ratio
      A[key + side] = { x: spine(p.y) + sg * d * hw, y: p.y }
    }
  }
  if (repaired > 4) { anchorDebug.push({ msg: `outline unusable (${repaired} anchors repaired)` }); return null }
  const k = CANON.spineMid[1] / CANON.sacrum[1], ym = A.C7.y + k * (A.sacrum.y - A.C7.y)
  A.spineMid = { x: spine(ym), y: ym }
  // sanity: anchors must form a plausible torso
  const dl = (p: P) => Math.abs(p.x - spine(p.y)) / hw
  const ok = A.pitL.x < A.pitR.x && A.waistR.x - A.waistL.x > 0.8 * hw && crestY > best[2]
    && [A.pitL, A.pitR, A.waistL, A.waistR, A.crestL, A.crestR].every((p) => dl(p) > 0.4 && dl(p) < 1.75)
  if (!ok) { anchorDebug.push({ msg: `implausible anchors hw=${hw.toFixed(0)} T=${Tl.toFixed(0)} ` + ['pitL', 'pitR', 'waistL', 'waistR', 'crestL', 'crestR'].map((k) => `${k}:${A[k].x.toFixed(0)},${A[k].y.toFixed(0)}/${dl(A[k]).toFixed(2)}`).join(' ') + ` waistW=${(best[1] - best[0]).toFixed(0)} crestY=${crestY.toFixed(0)} waistY=${best[2]}` }); return null }
  return Object.assign(A, { _T: { x: Tl, y: hw }, _hipsBad: { x: hipsBad ? 1 : 0, y: 0 } }) as Anchors
}

function trunkTps(A: Anchors): Tps {
  const src: V2[] = [], dst: V2[] = []
  const add = (c: V2, p: P) => { src.push(c); dst.push([p.x, p.y]) }
  add(CANON.C7, A.C7); add(CANON.neck, A.neck); add(CANON.sacrum, A.sacrum); add(CANON.spineMid, A.spineMid)
  for (const [side, sg] of [['L', 1], ['R', -1]] as const) {
    const f = (k: string): V2 => [CANON[k][0] * sg, CANON[k][1]]
    for (const k of ['pit', 'waist', 'crest', 'hip', 'acro', 'flank']) add(f(k), A[k + side])
    add(f('sh'), A['s' + side])
  }
  return new Tps(src, dst)
}

type LimbFrame = { map: (v: V2, unit: 'T' | 'bone') => P; Lrel: number; outline: P[]; S?: P; n?: P }
export const frameDebug: { f: string; S: P; n: P; outline: P[] }[] = []
function limbFrame(pose: Pose, m: Mask, frame: Exclude<Frame, 'trunk'>, side: 'L' | 'R', _view: 'front' | 'back'): LimbFrame | null {
  const Pp = pose.pts, Tl = pose.torsoLen
  const pick = (a: number, b: number) => { const [l, r] = [Pp[a], Pp[b]].sort((p, q) => (p && q ? p.x - q.x : 0)); return side === 'L' ? l : r }
  // joints by image side, matched by the side of the proximal joint
  const prox = frame === 'thigh' ? [23, 24] : frame === 'upperArm' ? [11, 12] : [13, 14]
  const dist = frame === 'thigh' ? [25, 26] : frame === 'upperArm' ? [13, 14] : [15, 16]
  if (!Pp[prox[0]] || !Pp[prox[1]]) return null
  const leftIdx = Pp[prox[0]].x <= Pp[prox[1]].x ? 0 : 1
  const i = side === 'L' ? leftIdx : 1 - leftIdx
  const S = Pp[prox[i]], E = Pp[dist[i]]
  void pick
  if (!S || !E) return null
  const d = { x: E.x - S.x, y: E.y - S.y }, Lb = Math.hypot(d.x, d.y)
  if (Lb < 4) return null
  const u = { x: d.x / Lb, y: d.y / Lb }
  let n = { x: -u.y, y: u.x }
  const hip = pose.named.hipM, other = Pp[prox[1 - i]]
  if (frame === 'thigh') { if (other && n.x * (S.x - other.x) + n.y * (S.y - other.y) < 0) n = { x: -n.x, y: -n.y } }
  else if (hip && n.x * (hip.x - S.x) + n.y * (hip.y - S.y) < 0) n = { x: -n.x, y: -n.y }
  const cap = (frame === 'thigh' ? 0.3 : 0.16) * Tl, lo = 0.05 * Tl
  const ray = (p: P, v: P) => { for (let r = 1; r < cap; r++) if (!inside(m, p.x + v.x * r, p.y + v.y * r)) return r; return cap }
  const ts = Array.from({ length: 10 }, (_, k) => 0.12 + (0.83 * k) / 9)
  const top = ts.map((t) => Math.min(cap, Math.max(lo, ray({ x: S.x + d.x * t, y: S.y + d.y * t }, { x: -n.x, y: -n.y }))))
  const bot = ts.map((t) => Math.min(cap, Math.max(lo, ray({ x: S.x + d.x * t, y: S.y + d.y * t }, n))))
  const interp = (arr: number[], t: number) => { const c = Math.max(ts[0], Math.min(ts[ts.length - 1], t)); let k = 0; while (k < ts.length - 2 && ts[k + 1] < c) k++; const f = (c - ts[k]) / (ts[k + 1] - ts[k]); return arr[k] + (arr[k + 1] - arr[k]) * f }
  const map = (v: V2, unit: 'T' | 'bone'): P => {
    const dd = v[0] * (unit === 'T' ? Tl : Lb), t = dd / Lb, w = v[1] < 0 ? interp(top, t) : interp(bot, t)
    return { x: S.x + u.x * dd + n.x * v[1] * w, y: S.y + u.y * dd + n.y * v[1] * w }
  }
  const outline = [...ts.map((t) => map([t, -1], 'bone')), ...ts.slice().reverse().map((t) => map([t, 1], 'bone'))]
  return { map, Lrel: Lb / Tl, outline, S, n } as LimbFrame
}

// ---------------- shape checks (shared with the tests) ----------------
const polyArea = (p: P[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q.x * r.y - r.x * q.y } return a / 2 }
function clipConvex(subject: P[], clip: P[]): P[] {
  // Sutherland–Hodgman against a convex CCW clip polygon (area of the result is exact even for concave subjects)
  let out = subject
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], inp = out
    out = []
    const side = (p: P) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = side(p), sq = side(q)
      if (sp >= 0) out.push(p)
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }) }
    }
  }
  return out
}
function hull(pts: P[]): P[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  const cr = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lo: P[] = [], up: P[] = []
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q) }
  return lo.slice(0, -1).concat(up.slice(0, -1))
}
/**
 * Triangle-likeness = best IoU between the outline and any triangle on its convex hull. 1 = a triangle.
 * (IoU, not "triangle area ÷ outline area": a curved/concave muscle such as the lats is NOT a triangle.)
 */
export function triangleIoU(poly: P[]): number {
  if (poly.length < 3) return 1
  const A = Math.abs(polyArea(poly))
  if (!(A > 0)) return 1
  let h = hull(poly)
  if (h.length > 22) { const step = h.length / 22; h = Array.from({ length: 22 }, (_, i) => h[Math.floor(i * step)]) }
  let best = 0
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) for (let k = j + 1; k < h.length; k++) {
    let tri = [h[i], h[j], h[k]]
    let ta = polyArea(tri)
    if (Math.abs(ta) < 0.3 * A) continue
    if (ta < 0) { tri = [h[i], h[k], h[j]]; ta = -ta }
    const inter = Math.abs(polyArea(clipConvex(poly, tri)))
    const iou = inter / (A + ta - inter)
    if (iou > best) best = iou
  }
  return best
}

// ---------------- fit ----------------
export type ArtFit = { drawn: DrawnMuscle[]; notDrawn: NotDrawn[]; occluders: P[][]; covered: Set<Fine>; anchors: Anchors | null }
/**
 * Which artwork set fits this photo. The shoulder-order view (formCheck) must agree with the face depth cue
 * (nose clearly nearer to the camera than the ears = facing us; clearly farther = back to us). A near-square-on
 * photo that formCheck calls "side" (e.g. a pull-up with hunched shoulders) is accepted when the face cue is strong.
 * Anything ambiguous → null → the artwork is not drawn at all.
 */
export function artView(pose: Pose, face?: 'skin' | 'dark'): 'front' | 'back' | null {
  const z = pose.z ?? {}
  const ears = [z[7], z[8]].filter((v) => typeof v === 'number')
  if (typeof z[0] !== 'number' || !ears.length) return null
  const facing = z[0] - ears.reduce((a, b) => a + b, 0) / ears.length
  if (pose.view === 'front' && facing < -0.14 && face !== 'dark') return 'front'
  if (pose.view === 'back' && facing > 0.1 && face !== 'skin') return 'back'
  if (pose.view === 'side' && (pose.spread ?? 0) >= 0.42 && Math.abs(facing) > 0.2) {
    const v = facing > 0 ? 'back' : 'front'
    if ((v === 'back' && face === 'dark') || (v === 'front' && face === 'skin')) return v
  }
  return null
}
export function fitArt(pose: Pose, mask: Mask, roles: Partial<Record<Fine, Role>>, isPrimitive: (p: P[]) => boolean, view: 'front' | 'back'): ArtFit {
  anchorDebug.length = 0; frameDebug.length = 0   // debug info of the last fit only
  const lib = ART.filter((m) => m.view === view)
  const covered = new Set(lib.map((m) => m.id))
  const wanted = (Object.keys(roles) as Fine[]).filter((id) => covered.has(id))
  const A = measureAnchors(pose, mask)
  const tps = A ? trunkTps(A) : null
  const frames = new Map<string, LimbFrame | null>()
  const frameOf = (f: Exclude<Frame, 'trunk'>, s: 'L' | 'R') => { const k = f + s; if (!frames.has(k)) { const fr = limbFrame(pose, mask, f, s, view); frames.set(k, fr); if (fr) frameDebug.push({ f: k, S: fr.S!, n: fr.n!, outline: fr.outline }) } return frames.get(k)! }
  // thighs: only on a near-straight hip (standing / lunging), and only when the hip landmarks really sit below
  // the iliac crest found from the outline — a seated or foreshortened thigh puts the quads on the belly
  const hipAng = pose.metrics.hip?.v
  if (A) anchorDebug.push({ msg: `crest ${((A.crestL.y + A.crestR.y) / 2).toFixed(0)} hips ${pose.pts[23]?.y} ${pose.pts[24]?.y} hipAng ${hipAng}` })
  const thighOk = !!A && !A._hipsBad?.x && (hipAng === undefined || hipAng >= 130) && [pose.pts[23], pose.pts[24]].every((h) => h && h.y >= (A.crestL.y + A.crestR.y) / 2 - 0.15 * A._T.x)
  const drawn: DrawnMuscle[] = [], notDrawn: NotDrawn[] = []
  // a point on the body outline counts as inside (tolerance 2% of the torso length — mask edges are soft)
  const tol = 0.02 * pose.torsoLen
  const near = (p: P) => inside(mask, p.x, p.y) || inside(mask, p.x + tol, p.y) || inside(mask, p.x - tol, p.y) || inside(mask, p.x, p.y + tol) || inside(mask, p.x, p.y - tol)
  const insideFrac = (poly: P[]) => { let c = 0; for (const p of poly) if (near(p)) c++; return c / poly.length }
  for (const mus of lib.sort((a, b) => a.layer - b.layer)) {
    if (!wanted.includes(mus.id)) continue
    const role = roles[mus.id]!
    const polys: P[][] = [], fibs: P[][][] = [], bands: P[][][] = [], apo: boolean[] = []
    let fail = false
    for (const side of ['L', 'R'] as const) {
      const sg = side === 'L' ? 1 : -1
      for (const part of Object.values(mus.parts)) {
        let mapV: ((v: V2) => P) | null = null
        if (part.frame === 'trunk') { if (tps) mapV = (v) => tps.map([v[0] * sg, v[1]]) }
        else if (part.frame !== 'thigh' || thighOk) { const fr = frameOf(part.frame, side); if (fr && fr.Lrel >= (part.minArm ?? 0)) mapV = (v) => fr.map(v, part.unit ?? 'bone') }
        if (!mapV) { if (part.frame === 'trunk') fail = true; continue }
        const C = coons(part)
        const Cp = C.map((row) => row.map(mapV!))
        const ol = outlineOf(Cp as unknown as V2[][]) as unknown as P[]
        const inf = insideFrac(ol)
        if (inf < 0.7) { anchorDebug.push({ msg: `${mus.id}.${side} inside ${inf.toFixed(2)}` }); continue }
        if (!part.apo && isPrimitive(ol)) { anchorDebug.push({ msg: `${mus.id}.${side} primitive` }); continue }
        polys.push(ol); apo.push(!!part.apo)
        fibs.push(part.apo ? [] : fibresOf(Cp as unknown as V2[][], part.nf ?? 10) as unknown as P[][])
        bands.push(part.bands ? bandsOf(Cp as unknown as V2[][], part.bands) as unknown as P[][] : [])
      }
    }
    if (mus.polyLeft && tps) {
      const left = mus.polyLeft.map((v) => tps.map(v)), right = mus.polyLeft.slice().reverse().map((v) => tps.map([-v[0], v[1]]))
      const sheet = [...left, ...right]
      if (insideFrac(sheet) >= 0.7) { polys.unshift(sheet); apo.unshift(true); fibs.unshift([]); bands.unshift([]) }
    }
    const flesh = polys.filter((_, i) => !apo[i])
    if (!flesh.length) { notDrawn.push({ id: mus.id, role, reason: fail ? 'fit' : 'fit' }); continue }
    // label anchor: centroid of the largest fleshy part on the image-left side
    let big = flesh[0]
    for (const p of flesh) if (Math.abs(polyArea(p)) > Math.abs(polyArea(big)) * (p[0].x < big[0].x ? 0.8 : 1.25)) big = p
    const anchor = big.reduce((a, b) => ({ x: a.x + b.x / big.length, y: a.y + b.y / big.length }), { x: 0, y: 0 })
    const seg = Object.values(mus.parts)[0].frame === 'trunk' ? 'torso' : Object.values(mus.parts)[0].frame
    drawn.push({ id: mus.id, role, seg, polys, fibers: fibs.flat(), anchor, partFibers: fibs, partBands: bands, apo, layer: mus.layer } as DrawnMuscle)
  }
  // arms in front of / behind the trunk hide trunk muscles where they overlap
  const occluders: P[][] = []
  for (const f of ['upperArm', 'forearm'] as const) for (const s of ['L', 'R'] as const) { const fr = frameOf(f, s); if (fr) occluders.push(fr.outline) }
  return { drawn, notDrawn, occluders, covered, anchors: A }
}
