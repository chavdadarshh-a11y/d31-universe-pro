/**
 * MediaPipe Tasks Vision helpers (runs 100% in the browser — no video leaves the phone).
 * Visual rule for D31: thin lines + small joint dots + angle pills. No glow, no blobs.
 */
import type { NormalizedLandmark, PoseLandmarker as PL } from '@mediapipe/tasks-vision'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const cache: Partial<Record<'IMAGE' | 'VIDEO', Promise<PL>>> = {}

export function getLandmarker(mode: 'IMAGE' | 'VIDEO'): Promise<PL> {
  if (!cache[mode]) {
    cache[mode] = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(WASM)
      const make = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: mode,
          numPoses: 1,
        })
      try {
        return await make('GPU')
      } catch {
        return await make('CPU')
      }
    })()
    cache[mode]!.catch(() => delete cache[mode])
  }
  return cache[mode]!
}

/** Angle ABC in degrees (B is the vertex). */
export function angle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const ab = Math.atan2(a.y - b.y, a.x - b.x)
  const cb = Math.atan2(c.y - b.y, c.x - b.x)
  let deg = Math.abs(((ab - cb) * 180) / Math.PI)
  if (deg > 180) deg = 360 - deg
  return deg
}

// MediaPipe indices
export const L = { sh: 11, el: 13, wr: 15, hip: 23, knee: 25, ank: 27 }
export const R = { sh: 12, el: 14, wr: 16, hip: 24, knee: 26, ank: 28 }

const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32],
]

const vis = (p?: NormalizedLandmark) => !!p && (p.visibility ?? 1) > 0.5

/** Pick the side facing the camera (higher visibility). */
export function bestSide(lm: NormalizedLandmark[]) {
  const score = (s: typeof L) => [s.sh, s.el, s.hip, s.knee, s.ank].reduce((a, i) => a + (lm[i]?.visibility ?? 0), 0)
  return score(L) >= score(R) ? L : R
}

export type JointAngle = { name: 'knee' | 'hip' | 'elbow'; deg: number; at: NormalizedLandmark }

export function keyAngles(lm: NormalizedLandmark[]): JointAngle[] {
  const s = bestSide(lm)
  const out: JointAngle[] = []
  if (vis(lm[s.hip]) && vis(lm[s.knee]) && vis(lm[s.ank])) out.push({ name: 'knee', deg: angle(lm[s.hip], lm[s.knee], lm[s.ank]), at: lm[s.knee] })
  if (vis(lm[s.sh]) && vis(lm[s.hip]) && vis(lm[s.knee])) out.push({ name: 'hip', deg: angle(lm[s.sh], lm[s.hip], lm[s.knee]), at: lm[s.hip] })
  if (vis(lm[s.sh]) && vis(lm[s.el]) && vis(lm[s.wr])) out.push({ name: 'elbow', deg: angle(lm[s.sh], lm[s.el], lm[s.wr]), at: lm[s.el] })
  return out
}

export function drawPose(
  ctx: CanvasRenderingContext2D,
  lm: NormalizedLandmark[],
  w: number,
  h: number,
  opts: { angles?: JointAngle[]; mirror?: boolean } = {},
) {
  const px = (p: NormalizedLandmark) => [(opts.mirror ? 1 - p.x : p.x) * w, p.y * h] as const
  const lw = Math.max(1.5, Math.min(w, h) / 260)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = lw
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)'
  for (const [a, b] of BONES) {
    if (!vis(lm[a]) || !vis(lm[b])) continue
    const [x1, y1] = px(lm[a])
    const [x2, y2] = px(lm[b])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.fillStyle = '#ffffff'
  for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if (!vis(lm[i])) continue
    const [x, y] = px(lm[i])
    ctx.beginPath()
    ctx.arc(x, y, lw * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  // angle pills, offset to the side so they never cover the joint
  const fs = Math.round(Math.max(11, Math.min(w, h) / 34))
  ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`
  ctx.textBaseline = 'middle'
  for (const a of opts.angles ?? []) {
    const [x, y] = px(a.at)
    const label = `${a.name.toUpperCase()} ${Math.round(a.deg)}°`
    const tw = ctx.measureText(label).width
    const padX = fs * 0.6
    const bw = tw + padX * 2
    const bh = fs * 1.8
    let bx = x + fs * 1.2
    if (bx + bw > w - 4) bx = x - fs * 1.2 - bw
    const by = Math.min(h - bh - 4, Math.max(4, y - bh / 2))
    ctx.fillStyle = 'rgba(8, 10, 14, 0.82)'
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, bh / 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#e6fbff'
    ctx.fillText(label, bx + padX, by + bh / 2 + 1)
  }
  ctx.restore()
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
    if (!pts.every((i) => vis(lm[i]))) return { counted: false, angle: null }
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
