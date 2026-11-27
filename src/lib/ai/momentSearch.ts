/**
 * Pure Video Moment Finder logic: map a typed query (en/hi/gu / Hinglish) to a
 * search, segment reps from per-frame joint angles, and pick a timestamp.
 * No MediaPipe and no DOM here — the scanner feeds FrameMetrics in.
 */
export type FrameView = 'front' | 'back' | 'side' | 'unknown'

export type FrameMetrics = {
  t: number
  ok: boolean
  view: FrameView
  knee?: number
  hip?: number
  elbow?: number
  trunkLean?: number
  /** front view: knee width / ankle width; < 0.8 ≈ knees caving in */
  kneeRatio?: number
}

export type MomentKind = 'deepest-squat' | 'form-break' | 'deepest-pushup' | 'lockout' | 'reps'

export type RepSeg = {
  kind: 'squat' | 'pushup'
  start: number
  bottom: number
  end: number
  depth: number
  trunkAtBottom?: number
  kneeRatioAtBottom?: number
  view?: FrameView
}

export type MomentFlag = { t: number; reason: MomentReason; value?: number }
export type MomentReason = 'deepest-squat' | 'valgus' | 'trunk' | 'shallow-rep' | 'deepest-pushup' | 'lockout' | 'reps'

export type MomentHit = {
  kind: MomentKind
  t: number
  reason: MomentReason
  value?: number
  also?: MomentFlag[]
}

export const VALGUS_RATIO = 0.8
export const TRUNK_LEAN_MAX = 55
export const SHALLOW_DELTA = 15

const norm = (s: string) =>
  s.toLowerCase().normalize('NFC').replace(/[_\-.,/!?()'"`“”]/g, ' ').replace(/\s+/g, ' ').trim()

/** First matching kind, or null when the box is empty. */
export function parseMomentQuery(q: string): MomentKind | null {
  const s = norm(q)
  if (!s) return null
  const rules: [RegExp, MomentKind][] = [
    [/(deepest|lowest|bottom).{0,24}(push[\s-]?up|pushup)|सबह?से\s*(गहरा|नीचे|डीप).{0,16}(पुश|push)|sabse\s*(deep|niche).{0,12}push|સૌથી\s*(ઊંડી|નીચે|deep).{0,16}(પુશ|push)/, 'deepest-pushup'],
    [/(deepest|lowest|bottom).{0,24}(squat|skwat)|सबह?से\s*(गहरा|डीप|deep|नीचे).{0,16}(स्क्वाट|squat)|sabse\s*(deep|gehra|niche).{0,12}squat|સૌથી\s*(ઊંડી|deep|નીચે).{0,16}(સ્ક્વોટ|squat)|(squat|स्क्वाट|સ્ક્વોટ).{0,20}(deepest|sabse\s*niche|सबसे\s*नीचे)/, 'deepest-squat'],
    [/(form\s*break|where.{0,16}form|knees?\s*(cav|cave|caving|in)|chest\s*(drop|down|up)|trunk\s*lean|form.{0,20}(bigd|toot|टूट|बिगड़|तूट|તૂટ|બિગડ)|फॉर्म.{0,20}(कहाँ|कहा|टूट|बिगड़)|फ़ॉर्म.{0,20}(कहाँ|टूट)|ફોર્મ.{0,20}(ક્યાં|તૂટ))/, 'form-break'],
    [/(lock\s*out|lockout|top of (the )?squat|standing tall|खड़ा|लॉकआउट|લોકઆઉટ)/, 'lockout'],
    [/\b(reps?|रेप|रेप्स|વાર|count\s*reps|kitne\s*rep|कितने\s*रेप)/, 'reps'],
  ]
  for (const [re, k] of rules) if (re.test(s)) return k
  if (/(push[\s-]?up|pushup|पुश\s*अप|પુશ)/.test(s)) return 'deepest-pushup'
  if (/(squat|स्क्वाट|સ્ક્વોટ|deep|डीप|ઊંડ)/.test(s)) return 'deepest-squat'
  if (/(form|फॉर्म|फ़ॉर्म|ફોર્મ)/.test(s)) return 'form-break'
  return null
}

export function segmentReps(frames: FrameMetrics[], joint: 'knee' | 'elbow', down = joint === 'knee' ? 100 : 95, up = joint === 'knee' ? 160 : 155): RepSeg[] {
  const kind = joint === 'knee' ? 'squat' : 'pushup'
  const reps: RepSeg[] = []
  let phase: 'up' | 'down' = 'up'
  let start = 0, bottomT = 0, best = 180
  let trunkAt: number | undefined, ratioAt: number | undefined, viewAt: FrameView | undefined
  const take = (f: FrameMetrics, a: number) => {
    best = a
    bottomT = f.t
    trunkAt = f.trunkLean
    ratioAt = f.kneeRatio
    viewAt = f.view
  }
  for (const f of frames) {
    const a = f[joint]
    if (a == null || !f.ok) continue
    if (phase === 'up' && a < down) {
      phase = 'down'
      start = f.t
      take(f, a)
    } else if (phase === 'down') {
      if (a < best) take(f, a)
      if (a > up) {
        reps.push({ kind, start, bottom: bottomT, end: f.t, depth: best, trunkAtBottom: trunkAt, kneeRatioAtBottom: ratioAt, view: viewAt })
        phase = 'up'
        best = 180
      }
    }
  }
  if (phase === 'down' && best < down) {
    reps.push({ kind, start, bottom: bottomT, end: bottomT, depth: best, trunkAtBottom: trunkAt, kneeRatioAtBottom: ratioAt, view: viewAt })
  }
  return reps
}

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2
}

export function findDeepestSquat(frames: FrameMetrics[]): MomentHit | null {
  const reps = segmentReps(frames, 'knee')
  if (reps.length) {
    const r = reps.reduce((a, b) => (a.depth < b.depth ? a : b))
    return { kind: 'deepest-squat', t: r.bottom, reason: 'deepest-squat', value: Math.round(r.depth) }
  }
  const withKnee = frames.filter((f) => f.ok && f.knee != null)
  if (!withKnee.length) return null
  const f = withKnee.reduce((a, b) => ((b.knee ?? 180) < (a.knee ?? 180) ? b : a))
  return { kind: 'deepest-squat', t: f.t, reason: 'deepest-squat', value: Math.round(f.knee!) }
}

export function findDeepestPushup(frames: FrameMetrics[]): MomentHit | null {
  const reps = segmentReps(frames, 'elbow')
  if (reps.length) {
    const r = reps.reduce((a, b) => (a.depth < b.depth ? a : b))
    return { kind: 'deepest-pushup', t: r.bottom, reason: 'deepest-pushup', value: Math.round(r.depth) }
  }
  const withE = frames.filter((f) => f.ok && f.elbow != null)
  if (!withE.length) return null
  const f = withE.reduce((a, b) => ((b.elbow ?? 180) < (a.elbow ?? 180) ? b : a))
  return { kind: 'deepest-pushup', t: f.t, reason: 'deepest-pushup', value: Math.round(f.elbow!) }
}

export function findLockout(frames: FrameMetrics[]): MomentHit | null {
  const reps = segmentReps(frames, 'knee')
  if (reps.length) return { kind: 'lockout', t: reps[0]!.end, reason: 'lockout' }
  const up = frames.find((f) => f.ok && f.knee != null && f.knee >= 160)
  return up ? { kind: 'lockout', t: up.t, reason: 'lockout', value: Math.round(up.knee!) } : null
}

export function findFormBreaks(frames: FrameMetrics[]): MomentHit | null {
  const reps = segmentReps(frames, 'knee')
  const flags: MomentFlag[] = []
  if (reps.length) {
    const med = median(reps.map((r) => r.depth))
    for (const r of reps) {
      if (r.kneeRatioAtBottom != null && r.kneeRatioAtBottom < VALGUS_RATIO && r.view !== 'side') {
        flags.push({ t: r.bottom, reason: 'valgus', value: Math.round(r.kneeRatioAtBottom * 100) })
      }
      if (r.trunkAtBottom != null && r.trunkAtBottom > TRUNK_LEAN_MAX && r.view !== 'front') {
        flags.push({ t: r.bottom, reason: 'trunk', value: Math.round(r.trunkAtBottom) })
      }
      if (r.depth - med >= SHALLOW_DELTA) flags.push({ t: r.bottom, reason: 'shallow-rep', value: Math.round(r.depth) })
    }
  } else {
    for (const f of frames) {
      if (!f.ok) continue
      const deep = f.knee != null && f.knee < 110
      if (deep && f.kneeRatio != null && f.kneeRatio < VALGUS_RATIO) flags.push({ t: f.t, reason: 'valgus', value: Math.round(f.kneeRatio * 100) })
      if (deep && f.trunkLean != null && f.trunkLean > TRUNK_LEAN_MAX) flags.push({ t: f.t, reason: 'trunk', value: Math.round(f.trunkLean) })
    }
  }
  if (!flags.length) return null
  const [first, ...rest] = flags
  return { kind: 'form-break', t: first!.t, reason: first!.reason, value: first!.value, also: rest }
}

export function runMomentQuery(q: string, frames: FrameMetrics[]): MomentHit | null {
  const kind = parseMomentQuery(q) ?? 'deepest-squat'
  if (kind === 'deepest-squat') return findDeepestSquat(frames)
  if (kind === 'form-break') return findFormBreaks(frames)
  if (kind === 'deepest-pushup') return findDeepestPushup(frames)
  if (kind === 'lockout') return findLockout(frames)
  const sq = segmentReps(frames, 'knee')
  const pu = segmentReps(frames, 'elbow')
  const reps = sq.length >= pu.length ? sq : pu
  if (!reps.length) return null
  return { kind: 'reps', t: reps[0]!.bottom, reason: 'reps', value: reps.length, also: reps.slice(1).map((r) => ({ t: r.bottom, reason: 'reps' as const, value: Math.round(r.depth) })) }
}

export function fmtStamp(t: number): string {
  const s = Math.max(0, t)
  const m = Math.floor(s / 60)
  const r = s - m * 60
  const sec = r.toFixed(1).padStart(4, '0')
  return m ? `${m}:${sec}` : `${r.toFixed(1)}s`
}
