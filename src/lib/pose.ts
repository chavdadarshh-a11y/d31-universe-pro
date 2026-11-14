/**
 * MediaPipe Tasks Vision helpers (runs 100% in the browser — no video leaves the phone).
 * Visual rule for D31: thin lines + small joint dots + angle pills. No glow, no blobs.
 */
import type { NormalizedLandmark, PoseLandmarker as PL } from '@mediapipe/tasks-vision'
import { angle, conf, evaluatePose, L, layoutLabels, R, reliable, type JointAngle, type PoseResult } from './poseFilter'

// Self-hosted under the site (works offline once cached by the service worker); CDN as fallback.
const LOCAL = `${import.meta.env.BASE_URL}mediapipe`
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
const CDN_MODEL = (v: 'lite' | 'full') => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/1/pose_landmarker_${v}.task`
// photos use the more accurate "full" model; the live camera uses "lite" for speed
const variant = (mode: 'IMAGE' | 'VIDEO') => (mode === 'IMAGE' ? 'full' : 'lite')

const cache: Partial<Record<'IMAGE' | 'VIDEO', Promise<PL>>> = {}

export function getLandmarker(mode: 'IMAGE' | 'VIDEO'): Promise<PL> {
  if (!cache[mode]) {
    cache[mode] = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const v = variant(mode)
      const make = async (local: boolean, delegate: 'GPU' | 'CPU') => {
        const fileset = local
          ? { wasmLoaderPath: `${LOCAL}/vision_wasm_internal.js`, wasmBinaryPath: `${LOCAL}/vision_wasm_internal.wasm` }
          : await FilesetResolver.forVisionTasks(CDN_WASM)
        return PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: local ? `${LOCAL}/pose_landmarker_${v}.task` : CDN_MODEL(v), delegate },
          runningMode: mode,
          numPoses: 1,
        })
      }
      for (const [local, delegate] of [[true, 'GPU'], [true, 'CPU'], [false, 'GPU'], [false, 'CPU']] as const) {
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
