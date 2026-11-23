/**
 * Camera rep counters for Game mode (MediaPipe pose, on-device): squat (knee angle, with depth level per rep),
 * push-up (elbow angle), jumping jack (arms overhead + feet wide → back together = 1 rep).
 * Hysteresis + smoothing so a wobble is never counted twice.
 */
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { angle, conf, reliable, type Pt } from './poseFilter'
import { bestSide } from './pose'
import { romFamily, romFromAngle } from '../data/rom'

export type CamKind = 'squat' | 'pushup' | 'jacks'
export type RepEvent = { counted: boolean; visible: boolean; angle: number | null; phase: 'up' | 'down'; /** deepest angle of the rep just counted */ depth?: number; level?: number | null }

export class CamReps {
  reps = 0
  phase: 'up' | 'down' = 'up'
  private smooth: number | null = null
  private deepest = 180
  kind: CamKind
  constructor(kind: CamKind) { this.kind = kind }
  update(lm: NormalizedLandmark[]): RepEvent {
    if (this.kind === 'jacks') return this.jacks(lm)
    const s = bestSide(lm)
    const ids = this.kind === 'squat' ? [s.hip, s.knee, s.ank] : [s.sh, s.el, s.wr]
    if (!ids.every((i) => reliable(lm[i], 0.55))) return { counted: false, visible: false, angle: null, phase: this.phase }
    const raw = angle(lm[ids[0]], lm[ids[1]], lm[ids[2]])
    this.smooth = this.smooth === null ? raw : this.smooth * 0.55 + raw * 0.45
    const a = this.smooth
    const th = this.kind === 'squat' ? { down: 140, up: 162 } : { down: 110, up: 150 }
    let counted = false, depth: number | undefined, level: number | null | undefined
    if (this.phase === 'down') this.deepest = Math.min(this.deepest, a)
    if (this.phase === 'up' && a < th.down) { this.phase = 'down'; this.deepest = a }
    else if (this.phase === 'down' && a > th.up) {
      this.phase = 'up'; this.reps++; counted = true
      depth = Math.round(this.deepest)
      level = romFromAngle(romFamily(this.kind === 'squat' ? 'bodyweight-squat' : 'push-up'), this.deepest)
      this.deepest = 180
    }
    return { counted, visible: true, angle: a, phase: this.phase, depth, level }
  }
  private jacks(lm: NormalizedLandmark[]): RepEvent {
    const need = [11, 12, 15, 16, 23, 24, 27, 28]
    if (!need.every((i) => conf(lm[i] as Pt) >= 0.5)) return { counted: false, visible: false, angle: null, phase: this.phase }
    const shY = (lm[11].y + lm[12].y) / 2, hipW = Math.abs(lm[23].x - lm[24].x) || 0.05
    const handsUp = lm[15].y < shY - 0.04 && lm[16].y < shY - 0.04
    const handsDown = lm[15].y > shY + 0.05 && lm[16].y > shY + 0.05
    const feet = Math.abs(lm[27].x - lm[28].x) / hipW
    let counted = false
    if (this.phase === 'up' && handsUp && feet > 1.6) this.phase = 'down' // "open" star
    else if (this.phase === 'down' && handsDown && feet < 1.35) { this.phase = 'up'; this.reps++; counted = true }
    return { counted, visible: true, angle: null, phase: this.phase, level: counted ? 1 : undefined }
  }
  reset() { this.reps = 0; this.phase = 'up'; this.smooth = null; this.deepest = 180 }
}
