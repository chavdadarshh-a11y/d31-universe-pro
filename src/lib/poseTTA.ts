/**
 * Test-time augmentation for still photos: run the pose model on the photo AND its horizontal mirror,
 * then merge. Joints both runs agree on are averaged (less jitter, more precise joint centres); where they
 * disagree the original detection is kept as-is.
 */
import type { Pt } from './poseFilter'

const PAIRS: [number, number][] = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]]
const SWAP = (() => { const m = Array.from({ length: 33 }, (_, i) => i); for (const [a, b] of PAIRS) { m[a] = b; m[b] = a } return m })()
const v = (p: Pt) => Math.min(p.visibility ?? 0, p.presence ?? 1)

/** `flip` = landmarks detected on the mirrored image (x measured in the mirrored frame). W/H for aspect-correct distances. */
export function mergeFlip(lm: Pt[] | null | undefined, flip: Pt[] | null | undefined, W: number, H: number): Pt[] | null {
  if (!lm || lm.length < 33) return flip && flip.length >= 33 ? unflip(flip) : lm ?? null
  if (!flip || flip.length < 33) return lm
  const f = unflip(flip)
  // torso scale for the agreement threshold
  const mid = (a: Pt, b: Pt) => ({ x: ((a.x + b.x) / 2) * W, y: ((a.y + b.y) / 2) * H })
  const s = mid(lm[11], lm[12]), h = mid(lm[23], lm[24])
  const T = Math.max(20, Math.hypot(s.x - h.x, s.y - h.y))
  return lm.map((o, i) => {
    const q = f[i], vo = v(o), vq = v(q)
    const d = Math.hypot((o.x - q.x) * W, (o.y - q.y) * H)
    if (d < 0.12 * T) {
      const wo = Math.max(0.05, vo), wq = Math.max(0.05, vq), k = wq / (wo + wq)
      const z = o.z !== undefined && q.z !== undefined ? o.z * (1 - k) + q.z * k : o.z
      const vis = Math.max(vo, vq)
      return { x: o.x * (1 - k) + q.x * k, y: o.y * (1 - k) + q.y * k, z, visibility: vis, presence: vis }
    }
    // the two runs disagree: keep the original detection untouched (never upgrade a doubtful joint)
    return o
  })
}

function unflip(flip: Pt[]): Pt[] {
  return SWAP.map((j) => { const p = flip[j]; return { ...p, x: 1 - p.x } })
}
