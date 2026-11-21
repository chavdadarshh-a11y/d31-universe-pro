/**
 * MediaPipe Tasks Vision helpers (runs 100% in the browser — no video leaves the phone).
 * Visual rule for D31: thin lines + small joint dots + angle pills. No glow, no blobs.
 */
import type { NormalizedLandmark, PoseLandmarker as PL } from '@mediapipe/tasks-vision'
import { angle, conf, evaluatePose, L, layoutLabels, plausiblePose, R, reliable, type JointAngle, type PoseResult, type Pt } from './poseFilter'
import { mergeFlip } from './poseTTA'

// Self-hosted under the site (works offline once cached by the service worker); CDN as fallback.
const LOCAL = `${import.meta.env.BASE_URL}mediapipe`
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
const CDN_MODEL = (v: 'lite' | 'full') => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/1/pose_landmarker_${v}.task`
// photos use the more accurate "full" model; the live camera uses "lite" for speed
const variant = (mode: 'IMAGE' | 'VIDEO') => (mode === 'IMAGE' ? 'full' : 'lite')

const cache: Partial<Record<'IMAGE' | 'VIDEO' | 'IMAGE_NOSEG', Promise<PL>>> = {}

/** forget a landmarker whose wasm instance aborted (it can't be used again) */
export function resetLandmarker(mode: 'IMAGE' | 'VIDEO' | 'IMAGE_NOSEG') { delete cache[mode] }

export function getLandmarker(mode: 'IMAGE' | 'VIDEO' | 'IMAGE_NOSEG'): Promise<PL> {
  if (!cache[mode]) {
    cache[mode] = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const v = variant(mode === 'VIDEO' ? 'VIDEO' : 'IMAGE')
      const run = mode === 'VIDEO' ? 'VIDEO' : 'IMAGE'
      const make = async (local: boolean, delegate: 'GPU' | 'CPU') => {
        const fileset = local
          ? { wasmLoaderPath: `${LOCAL}/vision_wasm_internal.js`, wasmBinaryPath: `${LOCAL}/vision_wasm_internal.wasm` }
          : await FilesetResolver.forVisionTasks(CDN_WASM)
        return PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: local ? `${LOCAL}/pose_landmarker_${v}.task` : CDN_MODEL(v), delegate },
          runningMode: run,
          numPoses: 1,
          // person mask for photos: muscle outlines are fitted to + clipped by the real body contour
          outputSegmentationMasks: mode === 'IMAGE',
        })
      }
      // Photos run on the CPU: GPU (WebGL) inference can differ run-to-run on phones, and a photo must always
      // give the same result. The live camera keeps the GPU for speed.
      const order = run === 'IMAGE'
        ? ([[true, 'CPU'], [false, 'CPU']] as const)
        : ([[true, 'GPU'], [true, 'CPU'], [false, 'GPU'], [false, 'CPU']] as const)
      for (const [local, delegate] of order) {
        try {
          return await make(local, delegate)
        } catch (e) {
          if (!local && delegate === 'CPU') throw e
        }
      }
      throw new Error('Pose model failed to load')
    })()
    cache[mode]!.catch(() => delete cache[mode])
  }
  return cache[mode]!
}

export { angle, L, R, evaluatePose, type JointAngle, type PoseResult } from './poseFilter'

export type RawMask = { w: number; h: number; data: Float32Array }

/**
 * Still-photo detection: landmarks from the photo AND its mirror image merged (mergeFlip), plus the person mask.
 */
/** content hash of the pixels (identical photo ⇒ identical hash) */
export function pixelHash(c: HTMLCanvasElement): string {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ c.width ^ (c.height << 12)
  for (let i = 0; i < d.length; i += 4 * 3) { h1 = Math.imul(h1 ^ d[i] ^ (d[i + 1] << 8) ^ (d[i + 2] << 16), 16777619); h2 = Math.imul(h2 ^ d[i + 2] ^ (d[i] << 8), 2246822519) }
  return `${c.width}x${c.height}-${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`
}
const photoCache = new Map<string, { lm: Pt[] | null; mask: RawMask | null }>()
let detectChain: Promise<unknown> = Promise.resolve()

export async function detectPhoto(base: HTMLCanvasElement, full?: HTMLCanvasElement): Promise<{ lm: Pt[] | null; mask: RawMask | null; hash: string }> {
  const hash = pixelHash(base)
  const hit = photoCache.get(hash)
  if (hit) return { ...hit, hash }
  // one detection at a time — two quick taps can never interleave the photo and mirrored runs
  const job = detectChain.then(() => detectPhotoNow(base).then((r) => zoomIn(r, full ?? base)))
  detectChain = job.catch(() => {})
  const res = await job
  photoCache.set(hash, res)
  if (photoCache.size > 12) photoCache.delete(photoCache.keys().next().value!)
  return { ...res, hash }
}

/**
 * Some photos make the MediaPipe wasm abort inside the segmentation step ("Check failed: 1 == ChannelSize()").
 * An aborted instance is dead, so: drop it, retry once on a re-encoded copy (opaque RGB, even size), and as a
 * last resort detect the joints without a person mask (no muscle artwork then, but the check still works).
 */
async function detectPhotoNow(base: HTMLCanvasElement): Promise<{ lm: Pt[] | null; mask: RawMask | null }> {
  try { return await detectOnce(base, 'IMAGE') } catch { resetLandmarker('IMAGE') }
  const c = document.createElement('canvas')
  c.width = Math.max(16, Math.round(base.width / 16) * 16); c.height = Math.max(16, Math.round(base.height / 16) * 16)
  const x = c.getContext('2d')!
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(base, 0, 0, c.width, c.height)
  try {
    const r = await detectOnce(c, 'IMAGE')
    // landmarks are normalised; the mask is resampled to the real photo size by its own w/h
    return r
  } catch { resetLandmarker('IMAGE') }
  try { return await detectOnce(base, 'IMAGE_NOSEG') } catch (e) { resetLandmarker('IMAGE_NOSEG'); throw e }
}

/** bounding box (normalised) of the person mask, null if there is no clear person */
function maskBox(m: RawMask): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1, n = 0
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.data[y * m.w + x] > 0.5) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (n < 0.002 * m.w * m.h) return null
  return { x0: x0 / m.w, y0: y0 / m.h, x1: (x1 + 1) / m.w, y1: (y1 + 1) / m.h }
}
/**
 * Detection on a region of the photo — a crop (zoom in) or a region larger than the photo (black padding
 * around it) — with the joints and the person mask mapped back to the whole photo. Region in normalised
 * photo coordinates, may extend past 0…1.
 */
async function detectRegion(src: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number): Promise<{ lm: Pt[]; mask: RawMask | null } | null> {
  const cw = x1 - x0, ch = y1 - y0, sw = cw * src.width, sh = ch * src.height
  if (sw < 24 || sh < 24) return null
  const k = Math.min(4, 1080 / Math.max(sw, sh))
  const c = document.createElement('canvas')
  c.width = Math.max(16, Math.round((sw * k) / 2) * 2); c.height = Math.max(16, Math.round((sh * k) / 2) * 2)
  const x = c.getContext('2d')!
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'
  const kx = c.width / sw, ky = c.height / sh
  x.drawImage(src, -x0 * src.width * kx, -y0 * src.height * ky, src.width * kx, src.height * ky)
  let z: { lm: Pt[] | null; mask: RawMask | null }
  try { z = await detectOnce(c, 'IMAGE') } catch { resetLandmarker('IMAGE'); return null }
  if (!z.lm || z.lm.length < 33) return null
  const lm = z.lm.map((p) => ({ ...p, x: x0 + p.x * cw, y: y0 + p.y * ch, z: p.z !== undefined ? p.z * cw : p.z }))
  let mask: RawMask | null = null
  if (z.mask) {
    // the region's mask resampled into a full-frame mask (≤1600 px on the long side)
    const fw0 = z.mask.w / cw, fh0 = z.mask.h / ch, kk = Math.min(1, 1600 / Math.max(fw0, fh0))
    const fw = Math.max(1, Math.round(fw0 * kk)), fh = Math.max(1, Math.round(fh0 * kk))
    const data = new Float32Array(fw * fh)
    for (let yy = Math.max(0, Math.floor(y0 * fh)); yy < Math.min(fh, Math.ceil(y1 * fh)); yy++) for (let xx = Math.max(0, Math.floor(x0 * fw)); xx < Math.min(fw, Math.ceil(x1 * fw)); xx++) {
      const u = ((xx + 0.5) / fw - x0) / cw, v = ((yy + 0.5) / fh - y0) / ch
      if (u < 0 || v < 0 || u >= 1 || v >= 1) continue
      data[yy * fw + xx] = z.mask.data[Math.floor(v * z.mask.h) * z.mask.w + Math.floor(u * z.mask.w)]
    }
    mask = { w: fw, h: fh, data }
  }
  return { lm, mask }
}

/**
 * Anatomical sanity of a detection (0 = fine, higher = worse), using the person mask as ground truth:
 * limbs must run over the body, an upright body has its knees / feet below the hips, and the torso has
 * human proportions. Used to choose between detections — never to invent joints.
 */
export function poseSanity(lm: Pt[] | null, mask: RawMask | null, aspect: number): number {
  if (!lm || lm.length < 33) return 99
  const ok = (i: number) => reliable(lm[i])
  if (![11, 12, 23, 24].every(ok)) return 50
  let bad = 0
  const P = (i: number) => ({ x: lm[i].x * aspect, y: lm[i].y })
  const sh = { x: (P(11).x + P(12).x) / 2, y: (P(11).y + P(12).y) / 2 }, hp = { x: (P(23).x + P(24).x) / 2, y: (P(23).y + P(24).y) / 2 }
  const T = Math.hypot(hp.x - sh.x, hp.y - sh.y), hw = Math.hypot(P(11).x - P(12).x, P(11).y - P(12).y) / 2
  const ratio = T / (hw || 1e-6)
  if (ratio < 2.2 || ratio > 4.8) bad += 2
  const upright = hp.y - sh.y > 0.5 * T
  if (upright) for (const i of [25, 26, 27, 28, 29, 30, 31, 32]) if (lm[i] && (lm[i].visibility ?? 0) >= 0.5 && lm[i].y < hp.y - 0.15 * T) bad += i <= 26 ? 1 : 2
  if (mask) {
    const inM = (x: number, y: number) => { const mx = Math.floor(x * mask.w), my = Math.floor(y * mask.h); return mx >= 0 && my >= 0 && mx < mask.w && my < mask.h && mask.data[my * mask.w + mx] > 0.5 }
    for (const [a, b] of [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [24, 26]]) {
      if (!ok(a) || !ok(b)) continue
      let n = 0
      for (let k = 1; k <= 9; k++) { const t = k / 10; if (inM(lm[a].x + (lm[b].x - lm[a].x) * t, lm[a].y + (lm[b].y - lm[a].y) * t)) n++ }
      if (n < 6) bad++
    }
  }
  return bad
}

/**
 * Second opinions, both deterministic:
 *  - a person who fills the frame edge to edge (cropped limbs) is detected again with a black border around
 *    the photo — MediaPipe then often finds the real arms / hips it mislabelled (e.g. feet put on a raised arm);
 *  - a small person in a big frame is detected again zoomed in.
 * The new result replaces the first only when it is anatomically saner (poseSanity) and complete.
 */
async function zoomIn(r: { lm: Pt[] | null; mask: RawMask | null }, src: HTMLCanvasElement): Promise<{ lm: Pt[] | null; mask: RawMask | null }> {
  const aspect = src.width / (src.height || 1)
  const implausible = (lm: Pt[] | null) => !lm || lm.length < 33 || !plausiblePose(lm, aspect)
  let best = r, bestBad = poseSanity(r.lm, r.mask, aspect) + (implausible(r.lm) ? 20 : 0)
  // padded second opinion: only for a clearly broken first result, and only if it is clearly better
  if (bestBad >= 4) {
    const z = await detectRegion(src, -0.25, -0.25, 1.25, 1.25)
    if (z && !implausible(z.lm)) {
      const bad = poseSanity(z.lm, z.mask ?? best.mask, aspect)
      if (bad <= bestBad - 3) { best = { lm: z.lm, mask: z.mask ?? best.mask }; bestBad = bad }
    }
  }
  let b = best.mask ? maskBox(best.mask) : null
  if (!b && best.lm) {
    const ok = best.lm.filter((p) => reliable(p))
    if (ok.length >= 6) b = { x0: Math.min(...ok.map((p) => p.x)), y0: Math.min(...ok.map((p) => p.y)), x1: Math.max(...ok.map((p) => p.x)), y1: Math.max(...ok.map((p) => p.y)) }
  }
  if (b) {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0
    // zoomed second opinion: only when the person is clearly small in the frame
    if (Math.max(bw, bh) <= 0.62 && bw * bh <= 0.22) {
      const mx = 0.35 * Math.max(bw, bh / aspect), my = mx * aspect
      const z = await detectRegion(src, Math.max(0, b.x0 - mx), Math.max(0, b.y0 - my), Math.min(1, b.x1 + mx), Math.min(1, b.y1 + my))
      if (z && [11, 12, 23, 24].every((i) => reliable(z.lm[i])) && !implausible(z.lm)) {
        const bad = poseSanity(z.lm, z.mask, aspect)
        if (bad <= bestBad - 3) { best = { lm: z.lm, mask: z.mask ?? best.mask }; bestBad = bad }
      }
    }
  }
  return best
}

async function detectOnce(base: HTMLCanvasElement, mode: 'IMAGE' | 'IMAGE_NOSEG'): Promise<{ lm: Pt[] | null; mask: RawMask | null }> {
  const pl = await getLandmarker(mode)
  const r = pl.detect(base)
  let mask: RawMask | null = null
  const m = r.segmentationMasks?.[0]
  if (m) {
    try { mask = { w: m.width, h: m.height, data: new Float32Array(m.getAsFloat32Array()) } } catch { mask = null }
  }
  r.segmentationMasks?.forEach((x) => x.close())
  const lm = (r.landmarks[0] as Pt[] | undefined) ?? null
  let flip: Pt[] | null = null
  try {
    const f = document.createElement('canvas')
    f.width = base.width; f.height = base.height
    const fx = f.getContext('2d')!
    fx.translate(base.width, 0); fx.scale(-1, 1); fx.drawImage(base, 0, 0)
    const rf = pl.detect(f)
    rf.segmentationMasks?.forEach((x) => x.close())
    flip = (rf.landmarks[0] as Pt[] | undefined) ?? null
  } catch {
    // the mirrored run can abort the wasm instance too: it is dead now — drop it so the next detection
    // (zoom-in / padded second opinion, the next photo) gets a fresh one instead of hanging on it
    flip = null
    resetLandmarker(mode)
  }
  return { lm: mergeFlip(lm, flip, base.width, base.height), mask }
}

/** mask → small greyscale PNG for saved results */
export function maskToPng(m: RawMask, maxW = 270): string {
  const k = Math.min(1, maxW / m.w)
  const src = document.createElement('canvas'); src.width = m.w; src.height = m.h
  const sx = src.getContext('2d')!
  const img = sx.createImageData(m.w, m.h)
  for (let i = 0; i < m.w * m.h; i++) { const v = Math.round(Math.max(0, Math.min(1, m.data[i])) * 255); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255 }
  sx.putImageData(img, 0, 0)
  const out = document.createElement('canvas'); out.width = Math.round(m.w * k); out.height = Math.round(m.h * k)
  out.getContext('2d')!.drawImage(src, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

export async function pngToMask(url: string): Promise<RawMask | null> {
  const img = new Image()
  img.src = url
  try { await img.decode() } catch { return null }
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
  const x = c.getContext('2d')!
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  const data = new Float32Array(c.width * c.height)
  for (let i = 0; i < data.length; i++) data[i] = d[i * 4] / 255
  return { w: c.width, h: c.height, data }
}

const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
]

/** Pick the side facing the camera (higher confidence). */
export function bestSide(lm: NormalizedLandmark[]) {
  const score = (s: typeof L) => [s.sh, s.el, s.hip, s.knee, s.ank].reduce((a, i) => a + conf(lm[i]), 0)
  return score(L) >= score(R) ? L : R
}

/** Angles that pass every reliability check (empty if fewer than 2 joints pass). */
export function keyAngles(lm: NormalizedLandmark[]): JointAngle[] {
  return evaluatePose(lm).angles
}

export function drawPose(
  ctx: CanvasRenderingContext2D,
  lm: NormalizedLandmark[],
  w: number,
  h: number,
  opts: { angles?: JointAngle[]; mirror?: boolean; result?: PoseResult } = {},
) {
  const res = opts.result ?? evaluatePose(lm)
  if (!res.ok) return res
  const ok = new Set(res.points)
  const px = (p: { x: number; y: number }) => [(opts.mirror ? 1 - p.x : p.x) * w, p.y * h] as const
  const lw = Math.max(1.5, Math.min(w, h) / 260)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = lw
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)'
  for (const [a, b] of BONES) {
    if (!ok.has(a) || !ok.has(b)) continue
    const [x1, y1] = px(lm[a])
    const [x2, y2] = px(lm[b])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.fillStyle = '#ffffff'
  for (const i of ok) {
    const [x, y] = px(lm[i])
    ctx.beginPath()
    ctx.arc(x, y, lw * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  // angle pills: laid out so they never overlap each other or leave the image
  const angles = opts.angles ?? []
  if (angles.length) {
    const fs = Math.round(Math.max(11, Math.min(w, h) / 34))
    ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`
    ctx.textBaseline = 'middle'
    const padX = fs * 0.6
    const bh = fs * 1.8
    const labels = angles.map((a) => `${a.name.toUpperCase()} ${Math.round(a.deg)}°`)
    const boxes = layoutLabels(
      angles.map((a, i) => { const [x, y] = px(a.at); return { x, y, w: ctx.measureText(labels[i]).width + padX * 2, h: bh } }),
      w, h, 4, Math.max(3, fs * 0.3),
    )
    boxes.forEach((r, i) => {
      if (!r) return
      const [jx, jy] = px(angles[i].at)
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(jx, jy)
      ctx.lineTo(Math.min(Math.max(jx, r.x), r.x + r.w), Math.min(Math.max(jy, r.y), r.y + r.h))
      ctx.stroke()
      ctx.fillStyle = 'rgba(8, 10, 14, 0.85)'
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)'
      ctx.beginPath()
      ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e6fbff'
      ctx.fillText(labels[i], r.x + padX, r.y + r.h / 2 + 1)
    })
  }
  ctx.restore()
  return res
}

/** Rep counter state machine with hysteresis, for squats (knee) and push-ups (elbow). */
export type RepKind = 'squat' | 'pushup'
export class RepCounter {
  reps = 0
  phase: 'up' | 'down' = 'up'
  lastAngle = 180
  private smooth = 180
  kind: RepKind
  constructor(kind: RepKind) {
    this.kind = kind
  }
  get thresholds() {
    return this.kind === 'squat' ? { down: 100, up: 160 } : { down: 95, up: 155 }
  }
  update(lm: NormalizedLandmark[]): { counted: boolean; angle: number | null } {
    const s = bestSide(lm)
    const pts = this.kind === 'squat' ? [s.hip, s.knee, s.ank] : [s.sh, s.el, s.wr]
    if (!evaluatePose(lm).ok || !pts.every((i) => reliable(lm[i]))) return { counted: false, angle: null }
    const raw = angle(lm[pts[0]], lm[pts[1]], lm[pts[2]])
    this.smooth = this.smooth * 0.6 + raw * 0.4
    this.lastAngle = this.smooth
    const t = this.thresholds
    let counted = false
    if (this.phase === 'up' && this.smooth < t.down) this.phase = 'down'
    else if (this.phase === 'down' && this.smooth > t.up) {
      this.phase = 'up'
      this.reps++
      counted = true
    }
    return { counted, angle: this.smooth }
  }
  reset() {
    this.reps = 0
    this.phase = 'up'
    this.smooth = 180
  }
}
