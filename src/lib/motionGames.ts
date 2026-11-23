/**
 * Camera MOTION GAMES (pure logic, no DOM): WAVE RIDE, DEPTH METER (push-ups), SQUAT CHECK.
 * Input = MediaPipe pose landmarks (normalized 0..1, y down) + a clock in seconds. Everything is measured from
 * the pose only; when the joints we need are not confidently visible we say so and measure nothing.
 */
import { angle, conf, inFrame, type Pt } from './poseFilter.ts'

/** joint angle with the frame's aspect ratio undone (landmarks are normalized separately per axis) */
export const angleA = (a: Pt, b: Pt, c: Pt, aspect: number) => angle({ x: a.x * aspect, y: a.y }, { x: b.x * aspect, y: b.y }, { x: c.x * aspect, y: c.y })

/** joint confidence needed before a joint is used */
export const VIS_MIN = 0.5
const seen = (p?: Pt) => conf(p) >= VIS_MIN && inFrame(p, 0.005)
const SIDES = [
  { sh: 11, el: 13, wr: 15, hip: 23, knee: 25, ank: 27 },
  { sh: 12, el: 14, wr: 16, hip: 24, knee: 26, ank: 28 },
] as const
type Side = (typeof SIDES)[number]
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN }

/** sides whose shoulder, elbow and wrist are all visible */
export const armSides = (lm: Pt[]) => SIDES.filter((s) => seen(lm[s.sh]) && seen(lm[s.el]) && seen(lm[s.wr]))
/** sides whose shoulder, hip, knee and ankle are all visible */
export const legSides = (lm: Pt[]) => SIDES.filter((s) => seen(lm[s.sh]) && seen(lm[s.hip]) && seen(lm[s.knee]) && seen(lm[s.ank]))
export const upperVisible = (lm?: Pt[] | null) => !!lm && armSides(lm).length > 0
export const fullVisible = (lm?: Pt[] | null) => !!lm && legSides(lm).length > 0

// ── shared: get-in-position + 3-2-1 ────────────────────────────────────────────────────────────────
export const POSITION_HOLD = 1.0 // s the body must stay visible before the countdown starts
export const COUNT_SEC = 3
export class Countdown {
  t = 0
  /** returns the number to show (3, 2, 1), 0 = GO (done) */
  step(dt: number) { this.t += dt; return Math.max(0, COUNT_SEC - Math.floor(this.t)) }
  get done() { return this.t >= COUNT_SEC }
}

// ── WAVE RIDE ──────────────────────────────────────────────────────────────────────────────────────
export type WaveMove = 'pushup' | 'squat'
/** wave n (1-based): period, half amplitude (of the 0..1 track), tolerance (half band), cycles per wave */
export function waveParams(n: number) {
  return {
    period: Math.max(1.5, 3.0 - 0.25 * (n - 1)),
    amp: Math.min(0.45, 0.32 + 0.04 * (n - 1)),
    tol: Math.max(0.14, 0.22 - 0.012 * (n - 1)),
    cycles: 3,
  }
}
export const waveLen = (n: number) => { const p = waveParams(n); return p.period * p.cycles }
/** track height 0..1 (1 = UP / top position) at `tau` seconds into wave n. Every wave starts at the top. */
export function waveTarget(n: number, tau: number) {
  const p = waveParams(n)
  return 0.5 + p.amp * Math.cos((2 * Math.PI * tau) / p.period)
}
/** track height `s` seconds from now (s may be negative), crossing into the previous / next wave */
export function trackAt(n: number, tau: number, s: number): { v: number; wave: number } {
  let w = n, x = tau + s
  while (x >= waveLen(w)) { x -= waveLen(w); w++ }
  while (x < 0 && w > 1) { w--; x += waveLen(w) }
  return { v: waveTarget(w, Math.max(0, x)), wave: w }
}

export const WAVE = {
  lives: 3,
  wipeAfter: 0.6, // s off the track → WIPED OUT
  comboBreak: 0.25, // s off the track → combo resets
  grace: 1.5, // s of grace after a wipe-out
  lags: [0, 0.1, 0.2, 0.3], // human reaction lag the ball is allowed
  pointsPerSec: 10,
  waveBonus: 100,
  calibHold: 3, // s per calibration step
  calibMinRange: 0.04, // top→bottom must move at least this much (of frame height)
} as const
export const waveMult = (ridingSec: number) => Math.min(4, 1 + Math.floor(ridingSec / 3) * 0.5)

/** body height signal: shoulders for push-ups, hips for squats (mean y of the visible ones) */
export function bodyY(lm: Pt[] | null | undefined, move: WaveMove): number | null {
  if (!lm) return null
  if (move === 'pushup') {
    if (!upperVisible(lm)) return null
    const ys = [11, 12].filter((i) => seen(lm[i])).map((i) => lm[i].y)
    return ys.length ? avg(ys) : null
  }
  if (!fullVisible(lm)) return null
  const ys = [23, 24].filter((i) => seen(lm[i])).map((i) => lm[i].y)
  return ys.length ? avg(ys) : null
}

export type WavePhase = 'calibTop' | 'calibBottom' | 'count' | 'play' | 'over'
export type WaveEvent = 'calibStep' | 'calibFail' | 'tick' | 'go' | 'wipe' | 'wave' | 'over'
export type WaveSnap = {
  phase: WavePhase; visible: boolean; calibLeft: number; calibFailed: boolean; count: number
  wave: number; tau: number; lives: number; score: number; mult: number; riding: boolean; wiped: boolean
  ball: number | null; trail: { t: number; v: number }[]; time: number; ridePct: number; bestMult: number; waves: number
  events: WaveEvent[]
}

export class WaveGame {
  move: WaveMove
  phase: WavePhase = 'calibTop'
  top = NaN; bottom = NaN
  private held = 0
  private samples: number[] = []
  calibFailed = false
  private cd = new Countdown()
  private lastCount = 4
  wave = 1; tau = 0; lives: number = WAVE.lives; scoreF = 0; time = 0
  private ridingFor = 0; private offFor = 0; private wipeUntil = -1
  private ball: number | null = null
  private trail: { t: number; v: number }[] = []
  private onTime = 0; bestMult = 1
  constructor(move: WaveMove) { this.move = move }
  get score() { return Math.round(this.scoreF) }

  update(lm: Pt[] | null | undefined, dtIn: number): WaveSnap {
    const dt = clamp(dtIn, 0, 0.1)
    const y = bodyY(lm, this.move)
    const ev: WaveEvent[] = []
    let riding = false
    if (this.phase === 'calibTop' || this.phase === 'calibBottom') {
      if (y !== null) {
        this.held += dt
        if (this.held >= WAVE.calibHold / 2) this.samples.push(y)
        if (this.held >= WAVE.calibHold) {
          const m = median(this.samples)
          this.held = 0; this.samples = []
          if (this.phase === 'calibTop') { this.top = m; this.phase = 'calibBottom'; ev.push('calibStep') }
          else if (m - this.top >= WAVE.calibMinRange) { this.bottom = m; this.phase = 'count'; this.calibFailed = false; ev.push('calibStep') }
          else { this.calibFailed = true; this.phase = 'calibTop'; this.top = NaN; ev.push('calibFail') }
        }
      }
    } else if (this.phase === 'count') {
      const n = this.cd.step(dt)
      if (n !== this.lastCount) { this.lastCount = n; ev.push(n > 0 ? 'tick' : 'go') }
      if (this.cd.done) this.phase = 'play'
    }
    if (y !== null && Number.isFinite(this.top) && Number.isFinite(this.bottom)) {
      const u = 1 - (y - this.top) / (this.bottom - this.top)
      this.ball = this.ball === null ? u : this.ball * 0.55 + u * 0.45
    }
    if (this.phase === 'play' && y !== null && this.ball !== null) {
      // the wave clock only runs while we can see you
      this.time += dt
      const b = this.ball
      const p = waveParams(this.wave)
      const err = Math.min(...WAVE.lags.map((l) => Math.abs(b - trackAt(this.wave, this.tau, -l).v)))
      const inGrace = this.time < this.wipeUntil
      if (!inGrace) {
        if (err <= p.tol) {
          this.offFor = 0; this.ridingFor += dt; riding = true; this.onTime += dt
          const m = waveMult(this.ridingFor); this.bestMult = Math.max(this.bestMult, m)
          this.scoreF += WAVE.pointsPerSec * m * dt
        } else {
          this.offFor += dt
          if (this.offFor > WAVE.comboBreak) this.ridingFor = 0
          if (this.offFor > WAVE.wipeAfter) {
            this.lives--; this.offFor = 0; this.ridingFor = 0; this.wipeUntil = this.time + WAVE.grace; ev.push('wipe')
            if (this.lives <= 0) { this.phase = 'over'; ev.push('over') }
          }
        }
      }
      this.tau += dt
      if (this.phase === 'play' && this.tau >= waveLen(this.wave)) {
        this.tau -= waveLen(this.wave); this.wave++; this.scoreF += WAVE.waveBonus * (this.wave - 1); ev.push('wave')
      }
      this.trail.push({ t: this.time, v: b })
      while (this.trail.length && this.trail[0].t < this.time - 1.6) this.trail.shift()
    }
    return this.snap(y !== null, riding, ev)
  }
  /** end now (pause → End) */
  finish() { if (this.phase !== 'over') { this.phase = 'over' } }
  private snap(visible: boolean, riding: boolean, events: WaveEvent[]): WaveSnap {
    return {
      phase: this.phase, visible, calibLeft: Math.max(0, Math.ceil(WAVE.calibHold - this.held)), calibFailed: this.calibFailed,
      count: Math.max(0, COUNT_SEC - Math.floor(this.cd.t)),
      wave: this.wave, tau: this.tau, lives: this.lives, score: this.score, mult: riding ? waveMult(this.ridingFor) : 1, riding,
      wiped: this.time < this.wipeUntil, ball: this.ball, trail: this.trail, time: this.time,
      ridePct: this.time > 0 ? Math.round((this.onTime / this.time) * 100) : 0, bestMult: this.bestMult, waves: this.wave - 1, events,
    }
  }
}

// ── DEPTH METER (push-ups) ─────────────────────────────────────────────────────────────────────────
/** elbow angles (°): lockout ≥ lock, a rep starts below start, full depth ≤ target, a "half rep" bottomed between target and half */
export const PUSH = { lock: 155, start: 140, target: 95, half: 130, relock: 110, rose: 130, zeroAt: 165, fullAt: 80 } as const
export const pushPct = (a: number) => Math.round(clamp((PUSH.zeroAt - a) / (PUSH.zeroAt - PUSH.fullAt)) * 100)
export const PUSH_TARGET_PCT = pushPct(PUSH.target)
export type DepthEvent = 'tick' | 'go' | 'rep' | 'half' | 'lockout'
export type DepthSnap = {
  phase: 'position' | 'count' | 'play'; visible: boolean; count: number; angle: number | null; pct: number; reached: boolean; down: boolean
  reps: number; halfReps: number; streak: number; bestStreak: number; tut: number; lastDown: number | null; lastUp: number | null; time: number
  cue: 'lower' | 'lockout' | null; events: DepthEvent[]
}
export class DepthGame {
  phase: DepthSnap['phase'] = 'position'
  private vis = 0
  private cd = new Countdown(); private lastCount = 4
  reps = 0; halfReps = 0; streak = 0; bestStreak = 0; tut = 0; time = 0
  private sm: number | null = null
  private down = false; private minA = 180; private start = 0; private bottomAt = 0; private reached = false; private rose = false
  lastDown: number | null = null; lastUp: number | null = null
  private cue: DepthSnap['cue'] = null; private cueUntil = 0
  private topAt = 0
  update(lm: Pt[] | null | undefined, dtIn: number, aspect = 3 / 4): DepthSnap {
    const dt = clamp(dtIn, 0, 0.1)
    const ev: DepthEvent[] = []
    const sides = lm ? armSides(lm) : []
    const visible = sides.length > 0
    let a: number | null = null
    if (visible && lm) {
      const raw = avg(sides.map((s: Side) => angleA(lm[s.sh], lm[s.el], lm[s.wr], aspect)))
      this.sm = this.sm === null ? raw : this.sm * 0.5 + raw * 0.5
      a = this.sm
    }
    if (this.phase === 'position') { this.vis = visible ? this.vis + dt : 0; if (this.vis >= POSITION_HOLD) this.phase = 'count' }
    else if (this.phase === 'count') {
      const n = this.cd.step(dt)
      if (n !== this.lastCount) { this.lastCount = n; ev.push(n > 0 ? 'tick' : 'go') }
      if (this.cd.done) this.phase = 'play'
    } else if (this.phase === 'play' && a !== null) {
      this.time += dt
      const t = this.time
      if (!this.down) {
        if (a >= PUSH.lock) this.topAt = t
        if (a < PUSH.start) { this.down = true; this.start = this.topAt || t; this.minA = a; this.bottomAt = t; this.reached = false; this.rose = false }
      } else {
        if (a < this.minA) { this.minA = a; this.bottomAt = t }
        if (a <= PUSH.target) this.reached = true
        if (this.reached && a > PUSH.rose) this.rose = true
        if (this.rose && a < PUSH.relock) {
          // came most of the way up, then went down again without locking out → not a rep
          this.streak = 0; this.say('lockout', t); ev.push('lockout')
          this.tut += t - this.start; this.start = t; this.minA = a; this.bottomAt = t; this.reached = a <= PUSH.target; this.rose = false
        } else if (a >= PUSH.lock) {
          this.tut += t - this.start; this.down = false
          if (this.reached) {
            this.reps++; this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak)
            this.lastDown = this.bottomAt - this.start; this.lastUp = t - this.bottomAt; ev.push('rep')
          } else if (this.minA <= PUSH.half) { this.halfReps++; this.streak = 0; this.say('lower', t); ev.push('half') }
        }
      }
    }
    if (this.cue && this.time > this.cueUntil) this.cue = null
    return {
      phase: this.phase, visible, count: Math.max(0, COUNT_SEC - Math.floor(this.cd.t)), angle: a, pct: a === null ? 0 : pushPct(a),
      reached: this.down && this.reached, down: this.down, reps: this.reps, halfReps: this.halfReps, streak: this.streak, bestStreak: this.bestStreak,
      tut: this.tut + (this.down && this.phase === 'play' ? this.time - this.start : 0), lastDown: this.lastDown, lastUp: this.lastUp, time: this.time,
      cue: this.cue, events: ev,
    }
  }
  private say(c: NonNullable<DepthSnap['cue']>, t: number) { this.cue = c; this.cueUntil = t + 1.4 }
}

// ── SQUAT CHECK ────────────────────────────────────────────────────────────────────────────────────
/**
 * Depth 0..100 % = the deeper of two real measurements:
 *  • knee angle (hip–knee–ankle): 170° → 0 %, 100° → 100 % (reliable side-on)
 *  • thigh drop: vertical hip→knee distance ÷ shin length: 1 (standing) → 0 % , 0 (hip level with knee) → 100 % (reliable facing the camera,
 *    where the 2-D knee angle stays almost straight because the thigh points at the lens)
 * Parallel = hip y at or below knee y, or knee angle ≤ 100°.
 */
export const SQ = {
  zeroAt: 170, parallel: 100,
  stand: 15, start: 30, cueFrom: 40, // depth % gates
  /** front view: knee spread / ankle spread below this = knees caving in */ kneeCave: 0.8,
  /** ankle spread must be at least this × hip width before we judge knees */ minStance: 0.5,
  /** side view: torso lean from vertical above this (°) = "chest up" */ leanMax: 55,
  persist: 0.3, cueHold: 1.4,
  /** shoulder width / torso length: ≥ front = facing the camera, ≤ side = side-on */ front: 0.45, side: 0.28,
} as const
export type SquatView = 'front' | 'side' | 'unknown'
export type SquatCue = 'deeper' | 'knees' | 'chest'
export type SquatEvent = 'tick' | 'go' | 'rep' | 'shallow' | 'cue' | 'done'
export type SquatSnap = {
  phase: 'position' | 'count' | 'play' | 'over'; visible: boolean; count: number; target: number; left: number; reps: number; shallow: number
  angle: number | null; pct: number; parallel: boolean; down: boolean; view: SquatView; lean: number | null; kneeRatio: number | null
  cue: SquatCue | null; cues: Record<SquatCue, number>; time: number; events: SquatEvent[]
}
/** torso lean from vertical in degrees; `aspect` = frame width / height (landmarks are normalized per axis) */
export function torsoLean(sh: Pt, hip: Pt, aspect: number) {
  const dx = (sh.x - hip.x) * aspect, dy = hip.y - sh.y
  return (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI
}
export function squatView(lm: Pt[], aspect: number): SquatView {
  const ls = lm[11], rs = lm[12]
  const sides = legSides(lm)
  if (!sides.length) return 'unknown'
  if (!(seen(ls) && seen(rs))) return 'side' // one whole side hidden behind the other = side-on
  const hip = sides.length === 2 ? { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 } : lm[sides[0].hip]
  const sh = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
  const torso = Math.hypot((sh.x - hip.x) * aspect, sh.y - hip.y)
  if (torso < 0.02) return 'unknown'
  const r = (Math.abs(ls.x - rs.x) * aspect) / torso
  return r >= SQ.front ? 'front' : r <= SQ.side ? 'side' : 'unknown'
}
export function squatDepth(lm: Pt[], aspect: number): { pct: number; angle: number; parallel: boolean } | null {
  const sides = legSides(lm)
  if (!sides.length) return null
  const a = avg(sides.map((s: Side) => angleA(lm[s.hip], lm[s.knee], lm[s.ank], aspect)))
  const hipY = avg(sides.map((s: Side) => lm[s.hip].y)), kneeY = avg(sides.map((s: Side) => lm[s.knee].y))
  const shin = avg(sides.map((s: Side) => Math.hypot((lm[s.knee].x - lm[s.ank].x) * aspect, lm[s.knee].y - lm[s.ank].y)))
  const byAngle = clamp((SQ.zeroAt - a) / (SQ.zeroAt - SQ.parallel))
  const byThigh = shin > 0.01 ? clamp(1 - (kneeY - hipY) / shin) : 0
  const parallel = hipY >= kneeY || a <= SQ.parallel
  return { pct: parallel ? 100 : Math.min(99, Math.round(Math.max(byAngle, byThigh) * 100)), angle: a, parallel }
}
export class SquatGame {
  phase: SquatSnap['phase'] = 'position'
  target: number
  reps = 0; shallow = 0; time = 0
  cues: Record<SquatCue, number> = { deeper: 0, knees: 0, chest: 0 }
  private vis = 0; private cd = new Countdown(); private lastCount = 4
  private sm: number | null = null
  private down = false; private reached = false
  private caveFor = 0; private leanFor = 0
  private cue: SquatCue | null = null; private cueUntil = 0
  constructor(target = 10) { this.target = target }
  update(lm: Pt[] | null | undefined, dtIn: number, aspect = 3 / 4): SquatSnap {
    const dt = clamp(dtIn, 0, 0.1)
    const ev: SquatEvent[] = []
    const d = lm ? squatDepth(lm, aspect) : null
    const visible = d !== null
    let pct = 0, parallel = false, view: SquatView = 'unknown', lean: number | null = null, kneeRatio: number | null = null
    if (d && lm) {
      this.sm = this.sm === null ? d.pct : this.sm * 0.5 + d.pct * 0.5
      parallel = d.parallel
      pct = parallel ? 100 : Math.min(99, Math.round(this.sm))
      view = squatView(lm, aspect)
      const sides = legSides(lm)
      if (view === 'front' && sides.length === 2) {
        const hipW = Math.abs(lm[23].x - lm[24].x), ankS = Math.abs(lm[27].x - lm[28].x), kneeS = Math.abs(lm[25].x - lm[26].x)
        if (hipW > 0.01 && ankS >= SQ.minStance * hipW) kneeRatio = kneeS / ankS
      }
      if (view === 'side') { const s = sides[0]; lean = torsoLean(lm[s.sh], lm[s.hip], aspect) }
    }
    if (this.phase === 'position') { this.vis = visible ? this.vis + dt : 0; if (this.vis >= POSITION_HOLD) this.phase = 'count' }
    else if (this.phase === 'count') {
      const n = this.cd.step(dt)
      if (n !== this.lastCount) { this.lastCount = n; ev.push(n > 0 ? 'tick' : 'go') }
      if (this.cd.done) this.phase = 'play'
    } else if (this.phase === 'play' && visible) {
      this.time += dt
      const t = this.time
      if (!this.down) { if (pct >= SQ.start) { this.down = true; this.reached = false } }
      else {
        if (parallel) this.reached = true
        // form cues only while actually squatting, and only from the view that can see them
        const deep = pct >= SQ.cueFrom
        this.caveFor = deep && kneeRatio !== null && kneeRatio < SQ.kneeCave ? this.caveFor + dt : 0
        this.leanFor = deep && lean !== null && lean > SQ.leanMax ? this.leanFor + dt : 0
        if (this.caveFor >= SQ.persist && this.cue !== 'knees') { this.say('knees', t); ev.push('cue') }
        if (this.leanFor >= SQ.persist && this.cue !== 'chest') { this.say('chest', t); ev.push('cue') }
        if (pct <= SQ.stand) {
          this.down = false; this.caveFor = 0; this.leanFor = 0
          if (this.reached) {
            this.reps++; ev.push('rep')
            if (this.reps >= this.target) { this.phase = 'over'; ev.push('done') }
          } else { this.shallow++; this.say('deeper', t); ev.push('shallow') }
        }
      }
    }
    if (this.cue && this.time > this.cueUntil) this.cue = null
    return {
      phase: this.phase, visible, count: Math.max(0, COUNT_SEC - Math.floor(this.cd.t)), target: this.target, left: Math.max(0, this.target - this.reps),
      reps: this.reps, shallow: this.shallow, angle: d ? d.angle : null, pct, parallel: visible && parallel, down: this.down, view, lean, kneeRatio,
      cue: visible ? this.cue : null, cues: this.cues, time: this.time, events: ev,
    }
  }
  finish() { this.phase = 'over' }
  private say(c: SquatCue, t: number) { this.cue = c; this.cueUntil = t + SQ.cueHold; this.cues[c]++ }
}
