// Motion games logic (WAVE RIDE, DEPTH METER, SQUAT CHECK) on synthetic pose sequences. Run via npm test.
import { angleA, DepthGame, PUSH, PUSH_TARGET_PCT, SquatGame, WAVE, WaveGame, bodyY, pushPct, squatView, trackAt, waveLen, waveParams, waveTarget } from '../src/lib/motionGames.ts'
import { type Pt } from '../src/lib/poseFilter.ts'
// @ts-ignore plain JS fixture
import { synthPose } from './fixtures/motionPoses.mjs'

let failed = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }
const P = (k: string, d: number, o: Record<string, unknown> = {}) => synthPose(k, d, o) as Pt[]
const DT = 1 / 30

// fixtures are what they claim
{
  const top = P('pushup', 0), bot = P('pushup', 1)
  ok(Math.abs(angleA(top[11], top[13], top[15], 0.75) - 170) < 1, 'fixture: push-up top elbow 170°')
  ok(Math.abs(angleA(bot[11], bot[13], bot[15], 0.75) - 78) < 1, 'fixture: push-up bottom elbow 78°')
  const s = P('squatSide', 0.5)
  ok(Math.abs(angleA(s[23], s[25], s[27], 0.75) - 127) < 1.5, 'fixture: side squat knee angle')
  ok(squatView(P('squatSide', 0.3), 0.75) === 'side', 'side squat detected as side view')
  ok(squatView(P('squatFront', 0.3), 0.75) === 'front', 'front squat detected as front view')
}

// ── WAVE RIDE
{
  ok(waveParams(2).period < waveParams(1).period && waveParams(2).amp > waveParams(1).amp, 'wave 2 faster + bigger than wave 1')
  ok(waveParams(3).tol < waveParams(1).tol, 'tolerance band narrows per wave')
  ok(Math.abs(waveTarget(1, 0) - (0.5 + waveParams(1).amp)) < 1e-9, 'every wave starts at the top')
  ok(trackAt(1, waveLen(1) - 0.1, 0.5).wave === 2, 'track preview crosses into the next wave')
  ok(bodyY(P('none', 0), 'pushup') === null, 'no body → no height')

  const yOf = (d: number) => bodyY(P('pushup', d), 'pushup')!
  const g = new WaveGame('pushup')
  let t = 0, s = g.update(null, DT)
  for (let i = 0; i < 60; i++) s = g.update(null, DT)
  ok(s.phase === 'calibTop' && s.calibLeft === WAVE.calibHold, 'calibration waits while the body is not visible')
  for (let i = 0; i < 95; i++) s = g.update(P('pushup', 0), DT)
  ok(s.phase === 'calibBottom', 'top held 3 s → bottom step')
  for (let i = 0; i < 95; i++) s = g.update(P('pushup', 1), DT)
  ok(s.phase === 'count' && Math.abs(g.top - yOf(0)) < 1e-6 && Math.abs(g.bottom - yOf(1)) < 1e-6, 'bottom held → calibrated top/bottom = median shoulder y')
  for (let i = 0; i < 95; i++) s = g.update(P('pushup', 0), DT)
  ok(s.phase === 'play', '3-2-1 → play')
  // follow the wave with a 0.15 s human lag for 2 full waves
  const follow = (secs: number, lag = 0.15) => {
    for (let i = 0; i < secs * 30; i++) {
      const u = trackAt(g.wave, g.tau, -lag).v // 1 = top
      s = g.update(P('pushup', 1 - u), DT); t += DT
    }
  }
  follow(waveLen(1) + waveLen(2) + 0.5)
  ok(s.wave === 3 && s.lives === 3, `riding the wave clears waves 1+2 with no lives lost (wave ${s.wave}, lives ${s.lives})`)
  ok(s.score > 300 && s.ridePct > 95, `score grows while riding (score ${s.score}, ride ${s.ridePct}%)`)
  ok(s.bestMult >= 2, `combo multiplier builds (best ×${s.bestMult})`)
  // stop moving at the top → wiped out after ~0.6 s off-track
  let wipeAt = -1, offStart = -1
  for (let i = 0; i < 90 && wipeAt < 0; i++) {
    s = g.update(P('pushup', 0.0), DT)
    const tgt = trackAt(g.wave, g.tau, 0).v
    if (offStart < 0 && Math.abs((s.ball ?? 0) - tgt) > waveParams(g.wave).tol + 0.05) offStart = i
    if (s.events.includes('wipe')) wipeAt = i
  }
  ok(wipeAt > 0 && s.lives === 2 && s.wiped, `freezing → WIPED OUT, a life lost (lives ${s.lives})`)
  ok(offStart >= 0 && (wipeAt - offStart) * DT >= 0.55 && (wipeAt - offStart) * DT <= 1.1, `wipe-out after ~0.6 s off-track (${((wipeAt - offStart) * DT).toFixed(2)} s incl. lag window)`)
  // invisible = paused (no wipe-outs while you can't be seen)
  const tau0 = g.tau
  for (let i = 0; i < 60; i++) s = g.update(null, DT)
  ok(g.tau === tau0 && s.lives === 2 && !s.visible, 'body lost → wave clock pauses, no penalty')
  // freeze until game over
  for (let i = 0; i < 900 && s.phase !== 'over'; i++) s = g.update(P('pushup', 0), DT)
  ok(s.phase === 'over' && s.lives === 0, '3 wipe-outs → game over')
  // calibration that does not move fails and restarts
  const g2 = new WaveGame('pushup')
  for (let i = 0; i < 95; i++) g2.update(P('pushup', 0.3), DT)
  let s2 = g2.update(P('pushup', 0.3), DT)
  for (let i = 0; i < 95; i++) s2 = g2.update(P('pushup', 0.32), DT)
  ok(s2.phase === 'calibTop' && s2.calibFailed, 'top ≈ bottom → calibration fails and asks again')
  // squat variant uses hips + needs the full body
  ok(bodyY(P('squatSide', 0.2), 'squat') !== null && bodyY(P('pushup', 0.2), 'squat') === null, 'squat wave needs the full body (hips)')
}

// ── DEPTH METER
{
  ok(PUSH_TARGET_PCT === pushPct(PUSH.target) && PUSH_TARGET_PCT > 75 && PUSH_TARGET_PCT < 90, `target line at ${PUSH_TARGET_PCT}% (elbow ${PUSH.target}°)`)
  const g = new DepthGame()
  let s = g.update(P('none', 0), DT)
  ok(!s.visible && s.phase === 'position', 'upper body not visible → waits in position check')
  for (let i = 0; i < 40; i++) s = g.update(P('pushup', 0), DT)
  ok(s.phase === 'count', 'upper body seen 1 s → countdown')
  for (let i = 0; i < 95; i++) s = g.update(P('pushup', 0), DT)
  ok(s.phase === 'play', 'countdown → play')
  const cycle = (bottom: number, downS = 1, upS = 0.8) => {
    const ev: string[] = []
    for (let i = 0; i < downS * 30; i++) { s = g.update(P('pushup', (i + 1) / (downS * 30) * bottom), DT); ev.push(...s.events) }
    for (let i = 0; i < upS * 30; i++) { s = g.update(P('pushup', bottom * (1 - (i + 1) / (upS * 30))), DT); ev.push(...s.events) }
    for (let i = 0; i < 6; i++) { s = g.update(P('pushup', 0), DT); ev.push(...s.events) }
    return ev
  }
  let ev = cycle(1)
  ok(ev.includes('rep') && s.reps === 1, 'full depth + lockout = 1 rep')
  ok(s.lastDown !== null && Math.abs(s.lastDown - 1) < 0.25 && s.lastUp !== null && Math.abs(s.lastUp - 0.8) < 0.3, `tempo read: down ${s.lastDown?.toFixed(2)} s, up ${s.lastUp?.toFixed(2)} s`)
  cycle(1); cycle(1)
  ok(s.reps === 3 && s.streak === 3, 'streak counts consecutive full reps')
  ev = cycle(0.55) // elbow ≈ 119° → half rep
  ok(ev.includes('half') && s.reps === 3 && s.halfReps === 1 && s.streak === 0 && s.cue === 'lower', 'half rep → not counted, "Go lower", streak reset')
  // reach depth, come up most of the way (no lockout), go down again
  ev = []
  for (let i = 0; i < 30; i++) { s = g.update(P('pushup', (i + 1) / 30), DT); ev.push(...s.events) }
  for (let i = 0; i < 18; i++) { s = g.update(P('pushup', 1 - (i + 1) / 30), DT); ev.push(...s.events) } // up to d=0.4 (~134°)
  for (let i = 0; i < 18; i++) { s = g.update(P('pushup', 0.4 + (i + 1) / 30), DT); ev.push(...s.events) }
  ok(ev.includes('lockout') && s.reps === 3 && s.cue === 'lockout', 'no lockout between reps → not counted, "Lock out" cue')
  for (let i = 0; i < 30; i++) s = g.update(P('pushup', 1 - (i + 1) / 30), DT)
  for (let i = 0; i < 6; i++) s = g.update(P('pushup', 0), DT)
  ok(s.reps === 4, 'after the lockout cue the next full rep counts')
  ok(s.tut > 6 && s.tut < 12, `time under tension accumulates (${s.tut.toFixed(1)} s)`)
  const r0 = s.reps
  for (let i = 0; i < 60; i++) s = g.update(P('pushup', 0.5, { vis: 0.3 }), DT)
  ok(!s.visible && s.reps === r0, 'low confidence → nothing measured')
  ok(pushPct(170) === 0 && pushPct(80) === 100, 'gauge 0 % at lockout, 100 % at 80°')
}

// ── SQUAT CHECK
for (const view of ['squatSide', 'squatFront'] as const) {
  const g = new SquatGame(10)
  let s = g.update(P(view, 0), DT)
  for (let i = 0; i < 40; i++) s = g.update(P(view, 0), DT)
  for (let i = 0; i < 95; i++) s = g.update(P(view, 0), DT)
  ok(s.phase === 'play' && s.left === 10, `${view}: position → 3-2-1 → play, ring at 10`)
  const rep = (bottom: number, o: Record<string, unknown> = {}) => {
    const ev: string[] = []; const cues = new Set<string>()
    for (let i = 0; i < 36; i++) { s = g.update(P(view, (i + 1) / 36 * bottom, o), DT); ev.push(...s.events); if (s.cue) cues.add(s.cue) }
    for (let i = 0; i < 30; i++) { s = g.update(P(view, bottom * (1 - (i + 1) / 30), o), DT); ev.push(...s.events); if (s.cue) cues.add(s.cue) }
    for (let i = 0; i < 4; i++) { s = g.update(P(view, 0, o), DT); ev.push(...s.events) }
    return { ev, cues }
  }
  let r = rep(1)
  ok(r.ev.includes('rep') && s.left === 9, `${view}: parallel rep → countdown 9`)
  // parallel reached at the bottom
  const deep = P(view, 1)
  const sp = new SquatGame(); sp.phase = 'play'
  ok(sp.update(deep, DT).parallel, `${view}: bottom position reads as parallel (line turns green)`)
  r = rep(0.45)
  ok(r.ev.includes('shallow') && s.left === 9 && r.cues.has('deeper'), `${view}: shallow rep → not counted, "Go deeper"`)
  if (view === 'squatFront') {
    r = rep(1, { cave: true })
    ok(r.cues.has('knees'), 'front: knees inside ankles → "Knees caving"')
    ok(!r.cues.has('chest'), 'front: no "Chest up" cue (lean not measurable facing the camera)')
  } else {
    r = rep(1, { lean: 68 })
    ok(r.cues.has('chest'), 'side: torso lean 68° → "Chest up"')
    ok(!r.cues.has('knees'), 'side: no "Knees caving" cue (not measurable side-on)')
    r = rep(1)
    ok(!r.cues.has('chest') && !r.cues.has('knees'), 'side: normal lean → no form cue')
  }
  for (let i = 0; i < 20 && s.phase !== 'over'; i++) rep(1)
  ok(s.phase === 'over' && s.left === 0 && s.reps === 10, `${view}: ring reaches 0 → done`)
}
{
  const g = new SquatGame(10); g.phase = 'play'
  const s = g.update(P('pushup', 0.5), DT)
  ok(!s.visible && s.cue === null, 'squat: legs not visible → no cues, "move back" state')
  const s2 = g.update(P('squatSide', 0.5, { vis: 0.35 }), DT)
  ok(!s2.visible, 'squat: low confidence joints → not measured')
}

console.log(failed ? `\n${failed} FAILED` : '\nall motion-game checks passed')
if (failed) process.exit(1)
