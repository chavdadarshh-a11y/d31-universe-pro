/**
 * Canvas renderers for the Analyze result "slide": photo + one of three overlays
 * (angles / muscles / technique) + condensed title + mono spec box.
 * Everything is anchored to clearly visible body points only (Pose.pts).
 * Muscles are drawn as solid, contained shapes (no blur, no glow).
 */
import type { Lang, MuscleId } from '../types'
import { l3, metricLabel, MUSCLE_NAMES, type Mode, type P, type Pose, type Profile } from './formCheck'

const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]]
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k })
const len = (a: P) => Math.hypot(a.x, a.y)
const norm = (a: P): P => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l } }
const perp = (a: P): P => ({ x: -a.y, y: a.x })
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y

const FONT_TITLE = '"Oswald", "Noto Sans Devanagari", "Noto Sans Gujarati", Impact, sans-serif'
const FONT_MONO = '"JetBrains Mono", "Noto Sans Devanagari", "Noto Sans Gujarati", ui-monospace, monospace'
const RED = '#ff3b30'
const ORANGE = { core: 'rgba(255,84,20,0.72)', edge: 'rgba(255,160,56,0.58)', line: '#ffd2a1', text: '#ff9a4d' }
const LIME = { core: 'rgba(184,255,60,0.5)', edge: 'rgba(170,240,50,0.36)', line: '#e4ff9e', text: '#c6ff5c' }
const BLUE = 'rgba(96,150,255,0.85)'

export type RenderOpts = {
  mode: Mode
  lang: Lang
  title: string
  subtitle: string
  profile: Profile
  muscles: { primary: MuscleId[]; secondary: MuscleId[] }
  spec: [string, string][]
  /** draw title + spec (off for the small thumbnail) */
  chrome?: boolean
}

export function renderAnalysis(canvas: HTMLCanvasElement, src: CanvasImageSource, pose: Pose, o: RenderOpts) {
  const W = pose.W, H = pose.H
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, W, H)
  ctx.fillStyle = 'rgba(4,6,10,0.22)'
  ctx.fillRect(0, 0, W, H)
  const drawn: string[] = []
  if (pose.ok) {
    // HOTFIX v4.2.1: the muscle photo overlay is disabled until the anatomical renderer ships (body map still shows muscles)
    if (o.mode === 'technique') drawTechnique(ctx, pose, o)
    else drawAngles(ctx, pose, o)
  }
  if (o.chrome !== false) {
    drawTitle(ctx, W, H, o.title, o.subtitle)
    drawSpec(ctx, W, H, o.spec)
  }
  return { drawnMuscles: drawn }
}

const fsBase = (W: number, H: number) => Math.round(Math.max(11, Math.min(22, Math.min(W, H) / 32)))

// ---------------- title + spec ----------------
function drawTitle(ctx: CanvasRenderingContext2D, W: number, H: number, title: string, subtitle: string) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.3)
  g.addColorStop(0, 'rgba(3,5,9,0.86)')
  g.addColorStop(1, 'rgba(3,5,9,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H * 0.3)
  const pad = W * 0.05
  let fs = Math.round(W * 0.085)
  ctx.font = `700 ${fs}px ${FONT_TITLE}`
  const words = title.toUpperCase().split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width > W - pad * 2 && cur) { lines.push(cur); cur = w } else cur = t
  }
  if (cur) lines.push(cur)
  if (lines.length > 2) { fs = Math.round(fs * 0.78); ctx.font = `700 ${fs}px ${FONT_TITLE}` }
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'top'
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, pad, pad + i * fs * 1.04))
  const sy = pad + Math.min(lines.length, 3) * fs * 1.04 + fs * 0.15
  ctx.font = `600 ${Math.round(fs * 0.3)}px ${FONT_MONO}`
  ctx.fillStyle = '#8be9ff'
  ctx.fillText(subtitle.toUpperCase(), pad, sy)
}

function drawSpec(ctx: CanvasRenderingContext2D, W: number, H: number, rows: [string, string][]) {
  if (!rows.length) return
  const fs = Math.round(fsBase(W, H) * 0.72)
  ctx.font = `600 ${fs}px ${FONT_MONO}`
  const lh = fs * 1.5
  const lines = rows.map(([k, v]) => [`${k.toUpperCase()}: `, v.toUpperCase()] as const)
  const maxW = Math.min(W * 0.66, Math.max(...lines.map(([k, v]) => ctx.measureText(k + v).width)) + fs * 2)
  const bh = lh * lines.length + fs * 1.2
  const x = W - maxW - W * 0.035, y = H - bh - W * 0.035
  ctx.fillStyle = 'rgba(6,8,12,0.82)'
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.rect(x, y, maxW, bh); ctx.fill(); ctx.stroke()
  ctx.textBaseline = 'middle'
  lines.forEach(([k, v], i) => {
    const ty = y + fs * 0.6 + lh * i + lh / 2
    ctx.fillStyle = RED
    ctx.fillText(k, x + fs, ty)
    ctx.fillStyle = '#e8edf5'
    const kw = ctx.measureText(k).width
    let txt = v
    while (txt.length > 3 && ctx.measureText(txt).width > maxW - fs * 2 - kw) txt = txt.slice(0, -2)
    ctx.fillText(txt === v ? v : txt + '…', x + fs + kw, ty)
  })
}

// ---------------- shared helpers ----------------
function arrowHead(ctx: CanvasRenderingContext2D, tip: P, dir: P, size: number, color: string) {
  const d = norm(dir), n = perp(d)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  const b = sub(tip, mul(d, size))
  ctx.lineTo(b.x + n.x * size * 0.5, b.y + n.y * size * 0.5)
  ctx.lineTo(b.x - n.x * size * 0.5, b.y - n.y * size * 0.5)
  ctx.closePath()
  ctx.fill()
}

type Box = { x: number; y: number; w: number; h: number }
const overlap = (a: Box, b: Box, g = 3) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g
/** place a pill near (x,y) avoiding other boxes + the title/spec zones */
function placeBox(w: number, h: number, x: number, y: number, W: number, H: number, taken: Box[]): Box | null {
  const cands: P[] = []
  for (const r of [1, 1.6, 2.4, 3.4]) for (const a of [0, 180, -40, 220, 40, 140, -90, 90]) cands.push({ x: x + Math.cos((a * Math.PI) / 180) * h * 1.6 * r, y: y + Math.sin((a * Math.PI) / 180) * h * 1.6 * r })
  for (const c of cands) {
    const b = { x: Math.min(W - w - 4, Math.max(4, c.x - (c.x < x ? w : 0))), y: Math.min(H - h - 4, Math.max(H * 0.2, c.y - h / 2)), w, h }
    if (!taken.some((t) => overlap(t, b))) { taken.push(b); return b }
  }
  return null
}
function pill(ctx: CanvasRenderingContext2D, text: string, anchor: P, W: number, H: number, taken: Box[], fs: number, accent = '#ffffff') {
  ctx.font = `600 ${fs}px ${FONT_MONO}`
  const w = ctx.measureText(text).width + fs * 1.1, h = fs * 1.8
  const b = placeBox(w, h, anchor.x, anchor.y, W, H, taken)
  if (!b) return
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(anchor.x, anchor.y)
  ctx.lineTo(Math.min(Math.max(anchor.x, b.x), b.x + b.w), Math.min(Math.max(anchor.y, b.y), b.y + b.h))
  ctx.stroke()
  ctx.fillStyle = 'rgba(6,8,12,0.8)'
  ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 3); ctx.fill()
  ctx.fillStyle = accent
  ctx.textBaseline = 'middle'
  ctx.fillText(text, b.x + fs * 0.55, b.y + b.h / 2 + 1)
}
function reserveChrome(W: number, H: number): Box[] {
  return [{ x: 0, y: 0, w: W, h: H * 0.19 }, { x: W * 0.4, y: H * 0.82, w: W * 0.6, h: H * 0.18 }]
}

// ---------------- MODE 1: angles ----------------
function drawAngles(ctx: CanvasRenderingContext2D, p: Pose, o: RenderOpts) {
  const { W, H, pts } = p
  const lw = Math.max(1.6, Math.min(W, H) / 300)
  const fs = Math.round(fsBase(W, H) * 0.8)
  ctx.save()
  ctx.lineCap = 'round'
  // dashed white limb lines through visible landmarks
  ctx.setLineDash([lw * 5, lw * 4])
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = lw
  for (const [a, b] of BONES) {
    if (!pts[a] || !pts[b]) continue
    ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.fillStyle = '#fff'
  for (const i of p.vis) if (i >= 11 && i <= 32 && (i <= 16 || i >= 23)) { ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, lw * 1.7, 0, Math.PI * 2); ctx.fill() }

  // red plumb line through the foot (only upright + foot visible)
  const foot = pts[31] && pts[27] ? lerp(pts[27], pts[31], 0.5) : pts[27] ?? pts[28]
  const top = p.named.shM
  if (!p.inverted && foot && top && p.metrics.trunkLean.v < 80) {
    const y0 = Math.max(H * 0.2, Math.min(top.y, p.pts[0]?.y ?? top.y) - p.torsoLen * 0.2)
    ctx.strokeStyle = RED
    ctx.lineWidth = lw * 1.4
    ctx.setLineDash([lw * 6, lw * 4])
    ctx.beginPath(); ctx.moveTo(foot.x, y0); ctx.lineTo(foot.x, foot.y); ctx.stroke()
    ctx.setLineDash([])
    arrowHead(ctx, { x: foot.x, y: foot.y + lw * 2 }, { x: 0, y: 1 }, lw * 7, RED)
  }

  const taken = reserveChrome(W, H)
  for (const key of o.profile.angles) {
    if (key === 'trunk') { protractor(ctx, p, o, lw, fs, taken); continue }
    if (key === 'bodyLine') { horizonArc(ctx, p, o, lw, fs, taken); continue }
    const m = p.metrics[key]
    if (!m || !m.a || !m.c || !m.at) continue
    jointArc(ctx, m.a, m.at, m.c, lw)
    pill(ctx, `${metricLabel(key, o.lang).toUpperCase()}: ${Math.round(m.v)}°`, m.at, W, H, taken, fs)
  }
  ctx.restore()
}

function jointArc(ctx: CanvasRenderingContext2D, a: P, b: P, c: P, lw: number) {
  const r = Math.max(14, Math.min(len(sub(a, b)), len(sub(c, b))) * 0.38)
  const a1 = Math.atan2(a.y - b.y, a.x - b.x)
  let a2 = Math.atan2(c.y - b.y, c.x - b.x)
  let d = a2 - a1
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  a2 = a1 + d
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = lw * 1.2
  ctx.beginPath(); ctx.arc(b.x, b.y, r, Math.min(a1, a2), Math.max(a1, a2)); ctx.stroke()
  // arrowheads on both ends, tangent to the arc
  for (const [ang, sgn] of [[a1, d > 0 ? -1 : 1], [a2, d > 0 ? 1 : -1]] as const) {
    const tip = { x: b.x + Math.cos(ang) * r, y: b.y + Math.sin(ang) * r }
    const tan = { x: -Math.sin(ang) * sgn, y: Math.cos(ang) * sgn }
    arrowHead(ctx, tip, tan, lw * 5, '#ffffff')
  }
  // outer dashed sweep (like the reference curved arrows) — only for clearly bent joints
  if (Math.abs(d) > (150 * Math.PI) / 180) return
  ctx.setLineDash([lw * 3, lw * 3])
  ctx.lineWidth = lw
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.7, Math.min(a1, a2), Math.max(a1, a2)); ctx.stroke()
  ctx.setLineDash([])
}

function protractor(ctx: CanvasRenderingContext2D, p: Pose, o: RenderOpts, lw: number, fs: number, taken: Box[]) {
  const hip = p.named.hipM, sh = p.named.shM
  if (!hip || !sh || p.inverted) return
  const R = p.torsoLen * 0.42
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = lw * 0.8
  ctx.beginPath(); ctx.moveTo(hip.x - R, hip.y); ctx.arc(hip.x, hip.y, R, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke()
  for (let a = 0; a <= 180; a += 10) {
    const t = Math.PI + (a * Math.PI) / 180, l = a % 30 === 0 ? R * 0.14 : R * 0.07
    ctx.beginPath()
    ctx.moveTo(hip.x + Math.cos(t) * R, hip.y + Math.sin(t) * R)
    ctx.lineTo(hip.x + Math.cos(t) * (R - l), hip.y + Math.sin(t) * (R - l))
    ctx.stroke()
  }
  // vertical reference (red) + torso line (white) + red sweep between them
  ctx.strokeStyle = RED
  ctx.lineWidth = lw * 1.4
  ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(hip.x, hip.y - R * 1.15); ctx.stroke()
  const dir = norm(sub(sh, hip))
  ctx.strokeStyle = '#fff'
  ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(hip.x + dir.x * R * 1.15, hip.y + dir.y * R * 1.15); ctx.stroke()
  const at = Math.atan2(dir.y, dir.x), up = -Math.PI / 2
  ctx.strokeStyle = RED
  ctx.lineWidth = lw * 1.8
  ctx.beginPath(); ctx.arc(hip.x, hip.y, R * 0.7, Math.min(at, up), Math.max(at, up)); ctx.stroke()
  arrowHead(ctx, { x: hip.x + Math.cos(at) * R * 0.7, y: hip.y + Math.sin(at) * R * 0.7 }, { x: -Math.sin(at) * (at < up ? -1 : 1), y: Math.cos(at) * (at < up ? -1 : 1) }, lw * 5, RED)
  ctx.restore()
  pill(ctx, `${metricLabel('trunkLean', o.lang).toUpperCase()}: ${Math.round(p.metrics.trunkLean.v)}°`, { x: hip.x, y: hip.y - R }, p.W, p.H, taken, fs, '#ffd0cc')
}

function horizonArc(ctx: CanvasRenderingContext2D, p: Pose, o: RenderOpts, lw: number, fs: number, taken: Box[]) {
  const key = p.metrics.bodyLine ? 'bodyLine' : 'torsoLine'
  const m = p.metrics[key]
  if (!m || !m.at || !m.a) return
  const a = m.at, b = m.a
  const dir = norm(sub(b, a))
  const hx = dir.x >= 0 ? 1 : -1
  const R = len(sub(b, a)) * 0.35
  ctx.save()
  ctx.strokeStyle = RED
  ctx.lineWidth = lw * 1.3
  ctx.setLineDash([lw * 6, lw * 4])
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + hx * len(sub(b, a)) * 1.05, a.y); ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = '#fff'
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  const t1 = hx > 0 ? 0 : Math.PI, t2 = Math.atan2(dir.y, dir.x)
  let d = t2 - t1
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  ctx.strokeStyle = RED
  ctx.lineWidth = lw * 1.8
  ctx.beginPath(); ctx.arc(a.x, a.y, R, Math.min(t1, t1 + d), Math.max(t1, t1 + d)); ctx.stroke()
  ctx.restore()
  pill(ctx, `${metricLabel(key, o.lang).toUpperCase()}: ${Math.round(m.v)}°`, lerp(a, b, 0.5), p.W, p.H, taken, fs, '#ffd0cc')
}

// ---------------- MODE 2: muscles ----------------
type Shape = { id: MuscleId; poly: P[]; fiber: P; anchor: P }

/** smooth muscle-belly shape along segment a→b (t0..t1). width/off are in pixels; side = unit normal for the offset. */
function lens(a: P, b: P, t0: number, t1: number, width: number, off = 0, side?: P): P[] {
  const d = sub(b, a)
  const n = side ?? norm(perp(d))
  const out: P[] = [], back: P[] = []
  const N = 16
  for (let i = 0; i <= N; i++) {
    const s = i / N
    const c = add(lerp(a, b, t0 + (t1 - t0) * s), mul(n, off))
    const hw = (width * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.55)) / 2
    out.push(add(c, mul(n, hw)))
    back.push(sub(c, mul(n, hw)))
  }
  return [...out, ...back.reverse()]
}

function torsoFrame(p: Pose): ((u: number, v: number) => P) | null {
  const P = p.pts
  if (p.view !== 'side') {
    if (!(P[11] && P[12] && P[23] && P[24])) return null
    // u = -1 at the person's right edge, +1 at the left edge; widths kept anatomically sane
    const T = p.torsoLen
    const widen = (r: P, l: P, min: number): [P, P] => {
      const m = lerp(r, l, 0.5), d = sub(l, r), w = len(d)
      if (w >= min) return [r, l]
      const u = w > 1 ? norm(d) : norm(sub(P[11], P[12]))
      return [sub(m, mul(u, min / 2)), add(m, mul(u, min / 2))]
    }
    const [sr, sl] = widen(P[12], P[11], 0.62 * T)
    const [hr, hl] = widen(P[24], P[23], 0.5 * Math.max(len(sub(sl, sr)), 0.62 * T))
    return (u, v) => { const k = (u * 1.14 + 1) / 2; return lerp(lerp(sr, sl, k), lerp(hr, hl, k), v) }
  }
  const sh = p.named.shM, hip = p.named.hipM
  if (!sh || !hip || !p.front) return null
  const f = p.front, w = p.torsoLen * 0.3
  return (u, v) => add(lerp(sh, hip, v), mul(f, u * w * (1 - 0.12 * v)))
}

// torso templates in (u,v); front/back views are mirrored for both sides
const T_FRONT: Partial<Record<MuscleId, { pts: [number, number][]; fiber: [number, number]; center?: boolean }>> = {
  chest: { pts: [[0.06, 0.05], [0.5, 0.0], [0.86, 0.1], [0.8, 0.3], [0.45, 0.38], [0.06, 0.33]], fiber: [1, 0.15] },
  abs: { pts: [[-0.24, 0.42], [0.24, 0.42], [0.22, 0.97], [-0.22, 0.97]], fiber: [1, 0], center: true },
  obliques: { pts: [[0.34, 0.44], [0.82, 0.36], [0.9, 0.72], [0.72, 0.98], [0.34, 0.92]], fiber: [0.6, 1] },
  lats: { pts: [[0.68, 0.14], [1.1, 0.2], [1.02, 0.62], [0.74, 0.52]], fiber: [0.3, 1] },
  traps: { pts: [[0.12, -0.16], [0.6, -0.03], [0.32, 0.03]], fiber: [1, 0.4] },
}
const T_BACK: typeof T_FRONT = {
  traps: { pts: [[0, -0.2], [0.58, -0.03], [0.24, 0.24], [0, 0.52]], fiber: [1, 0.5] },
  upper_back: { pts: [[0.06, 0.1], [0.44, 0.12], [0.4, 0.34], [0.06, 0.42]], fiber: [1, 0.3] },
  lats: { pts: [[0.44, 0.2], [0.96, 0.17], [0.92, 0.56], [0.46, 0.88], [0.16, 0.76], [0.34, 0.42]], fiber: [0.7, 1] },
  lower_back: { pts: [[0.03, 0.55], [0.22, 0.55], [0.24, 1.0], [0.03, 1.0]], fiber: [0, 1] },
  obliques: { pts: [[0.86, 0.6], [0.98, 0.72], [0.92, 0.98], [0.76, 0.96]], fiber: [0.4, 1] },
}
// side view: u = -1 back … +1 front
const T_SIDE: typeof T_FRONT = {
  chest: { pts: [[0.2, 0.04], [0.96, 0.08], [0.92, 0.34], [0.3, 0.38]], fiber: [1, 0.1] },
  abs: { pts: [[0.55, 0.42], [0.96, 0.44], [0.9, 0.97], [0.55, 0.97]], fiber: [1, 0] },
  obliques: { pts: [[-0.12, 0.42], [0.5, 0.4], [0.5, 0.96], [-0.06, 0.9]], fiber: [0.6, 1] },
  lats: { pts: [[-0.92, 0.14], [-0.2, 0.2], [0.0, 0.6], [-0.5, 0.82], [-0.88, 0.56]], fiber: [0.6, 1] },
  upper_back: { pts: [[-1, 0.0], [-0.5, 0.02], [-0.55, 0.3], [-0.96, 0.3]], fiber: [1, 0.2] },
  traps: { pts: [[-0.72, -0.16], [0.0, -0.12], [-0.2, 0.08], [-0.82, 0.08]], fiber: [1, 0.3] },
  lower_back: { pts: [[-0.96, 0.55], [-0.6, 0.55], [-0.6, 1.0], [-0.98, 1.0]], fiber: [0, 1] },
}

function buildShapes(p: Pose, want: Set<MuscleId>): Shape[] {
  const P = p.pts, shapes: Shape[] = []
  const frame = torsoFrame(p)
  const tmpl = p.view === 'front' ? T_FRONT : p.view === 'back' ? T_BACK : T_SIDE
  if (frame) {
    for (const [id, t] of Object.entries(tmpl) as [MuscleId, NonNullable<(typeof T_FRONT)[MuscleId]>][]) {
      if (!want.has(id)) continue
      const sides = p.view === 'side' || t.center ? [1] : [1, -1]
      for (const s of sides) {
        const poly = t.pts.map(([u, v]) => frame(u * s, v))
        const f0 = frame(0, 0.5), f1 = frame(t.fiber[0] * 0.2 * s, 0.5 + t.fiber[1] * 0.2)
        shapes.push({ id, poly, fiber: norm(sub(f1, f0)), anchor: centroid(poly) })
      }
    }
  }
  const center = p.named.shM && p.named.hipM ? lerp(p.named.shM, p.named.hipM, 0.5) : undefined
  const sideNormal = (a: P, b: P, toward: 'front' | 'back' | 'out' | 'in'): P | undefined => {
    const n = norm(perp(sub(b, a)))
    let ref: P | undefined
    if (toward === 'front' || toward === 'back') { if (!p.front) return undefined; ref = toward === 'front' ? p.front : mul(p.front, -1) }
    else { if (!center) return undefined; const mm = lerp(a, b, 0.5); ref = toward === 'out' ? sub(mm, center) : sub(center, mm) }
    return dot(n, ref) >= 0 ? n : mul(n, -1)
  }
  const limb = (id: MuscleId, a: number, b: number, t0: number, t1: number, w: number, rule: { front?: [number, number, 'front' | 'back' | 'out' | 'in'] | 'hide' | 'full'; back?: [number, number, 'front' | 'back' | 'out' | 'in'] | 'hide' | 'full'; side?: [number, number, 'front' | 'back'] | 'full' | 'hide' }) => {
    if (!want.has(id) || !P[a] || !P[b]) return
    const r = rule[p.view] ?? 'full'
    if (r === 'hide') return
    const T = p.torsoLen
    // skip badly foreshortened segments (would become a meaningless blob)
    if (len(sub(P[b], P[a])) < 0.28 * T) return
    let poly: P[]
    if (r === 'full') poly = lens(P[a], P[b], t0, t1, w * T)
    else {
      const n = sideNormal(P[a], P[b], r[2])
      poly = n ? lens(P[a], P[b], t0, t1, r[1] * T, r[0] * T, n) : lens(P[a], P[b], t0, t1, w * T)
    }
    shapes.push({ id, poly, fiber: norm(sub(P[b], P[a])), anchor: centroid(poly) })
  }
  for (const s of [{ sh: 11, el: 13, wr: 15, hip: 23, knee: 25, ank: 27 }, { sh: 12, el: 14, wr: 16, hip: 24, knee: 26, ank: 28 }]) {
    limb('shoulders', s.sh, s.el, -0.22, 0.42, 0.44, { back: [0, 0.34, 'out'] })
    limb('rear_delts', s.sh, s.el, -0.2, 0.4, 0.4, { front: 'hide', side: [0.08, 0.26, 'back'] })
    limb('biceps', s.sh, s.el, 0.28, 0.92, 0.27, { back: 'hide', side: [0.07, 0.18, 'front'] })
    limb('triceps', s.sh, s.el, 0.22, 0.94, 0.27, { front: [0.1, 0.14, 'out'], side: [0.07, 0.18, 'back'] })
    limb('forearms', s.el, s.wr, 0.04, 0.74, 0.23, {})
    limb('quads', s.hip, s.knee, 0.08, 0.94, 0.42, { back: 'hide', side: [0.08, 0.3, 'front'] })
    limb('hamstrings', s.hip, s.knee, 0.2, 0.94, 0.36, { front: 'hide', side: [0.09, 0.26, 'back'] })
    limb('glutes', s.hip, s.knee, -0.3, 0.3, 0.5, { front: 'hide', side: [0.16, 0.36, 'back'] })
    limb('adductors', s.hip, s.knee, 0.04, 0.62, 0.16, { front: [0.12, 0.16, 'in'], back: [0.12, 0.16, 'in'], side: 'hide' })
    limb('calves', s.knee, s.ank, 0.04, 0.62, 0.27, { front: [0.08, 0.14, 'out'], side: [0.07, 0.19, 'back'] })
  }
  return shapes
}

function centroid(poly: P[]): P {
  const s = poly.reduce((a, b) => add(a, b), { x: 0, y: 0 })
  return mul(s, 1 / poly.length)
}
function smoothPath(ctx: CanvasRenderingContext2D, poly: P[]) {
  const n = poly.length
  ctx.beginPath()
  const m0 = lerp(poly[n - 1], poly[0], 0.5)
  ctx.moveTo(m0.x, m0.y)
  for (let i = 0; i < n; i++) {
    const p1 = poly[i], m = lerp(p1, poly[(i + 1) % n], 0.5)
    ctx.quadraticCurveTo(p1.x, p1.y, m.x, m.y)
  }
  ctx.closePath()
}

export function drawMuscles(ctx: CanvasRenderingContext2D, p: Pose, o: RenderOpts): string[] {
  const prim = new Set(o.muscles.primary), sec = new Set(o.muscles.secondary.filter((m) => !prim.has(m)))
  const shapes = buildShapes(p, new Set([...prim, ...sec]))
  const lw = Math.max(1.2, Math.min(p.W, p.H) / 420)
  // secondary first so primaries sit on top
  const ordered = [...shapes.filter((s) => !prim.has(s.id)), ...shapes.filter((s) => prim.has(s.id))]
  for (const s of ordered) {
    const C = prim.has(s.id) ? ORANGE : LIME
    ctx.save()
    smoothPath(ctx, s.poly)
    const xs = s.poly.map((q) => q.x), ys = s.poly.map((q) => q.y)
    const r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2
    const g = ctx.createRadialGradient(s.anchor.x, s.anchor.y, 0, s.anchor.x, s.anchor.y, Math.max(4, r))
    g.addColorStop(0, C.core)
    g.addColorStop(1, C.edge)
    ctx.fillStyle = g
    ctx.fill()
    ctx.clip()
    // fibre striations, contained in the muscle outline
    const f = s.fiber, n = perp(f)
    ctx.strokeStyle = prim.has(s.id) ? 'rgba(110,24,0,0.5)' : 'rgba(40,80,0,0.5)'
    ctx.lineWidth = Math.max(0.8, lw * 0.6)
    const step = Math.max(2.5, r / 8)
    for (let k = -r * 1.2; k <= r * 1.2; k += step) {
      const c = add(s.anchor, mul(n, k))
      ctx.beginPath()
      ctx.moveTo(c.x - f.x * r * 1.3 + n.x * Math.sin(k) * 2, c.y - f.y * r * 1.3 + n.y * Math.sin(k) * 2)
      ctx.quadraticCurveTo(c.x + n.x * step * 0.6, c.y + n.y * step * 0.6, c.x + f.x * r * 1.3, c.y + f.y * r * 1.3)
      ctx.stroke()
    }
    ctx.restore()
    smoothPath(ctx, s.poly)
    ctx.strokeStyle = C.line
    ctx.lineWidth = lw * 1.3
    ctx.stroke()
  }
  // one leader label per muscle, stacked on the nearer side margin
  const fs = Math.round(fsBase(p.W, p.H) * 0.74)
  ctx.font = `700 ${fs}px ${FONT_MONO}`
  const seen = new Map<MuscleId, Shape>()
  for (const s of shapes) if (!seen.has(s.id) || s.anchor.y < seen.get(s.id)!.anchor.y) seen.set(s.id, s)
  const items = [...seen.values()].sort((a, b) => a.anchor.y - b.anchor.y)
  const taken = reserveChrome(p.W, p.H)
  const cols = { left: [] as Box[], right: [] as Box[] }
  for (const s of items) {
    const txt = l3(MUSCLE_NAMES[s.id], o.lang).toUpperCase()
    const w = ctx.measureText(txt).width + fs * 0.8, h = fs * 1.6
    const side = s.anchor.x < p.W / 2 ? 'left' : 'right'
    const x = side === 'left' ? Math.max(4, Math.min(s.anchor.x - p.W * 0.18, p.W * 0.03)) : Math.min(p.W - w - 4, Math.max(s.anchor.x + p.W * 0.18, p.W * 0.97 - w))
    let y = Math.max(p.H * 0.2, s.anchor.y - h / 2)
    let b = { x, y, w, h }
    for (let k = 0; k < 40 && [...taken, ...cols[side]].some((t) => overlap(t, b)); k++) { y += h * 0.6; b = { x, y, w, h } }
    if (y + h > p.H - 4) continue
    cols[side].push(b)
    const C = prim.has(s.id) ? ORANGE : LIME
    const end = { x: side === 'left' ? b.x + b.w : b.x, y: b.y + h / 2 }
    ctx.strokeStyle = C.line
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(s.anchor.x, s.anchor.y); ctx.lineTo(end.x + (side === 'left' ? fs : -fs), end.y); ctx.lineTo(end.x, end.y); ctx.stroke()
    ctx.fillStyle = C.line
    ctx.beginPath(); ctx.arc(s.anchor.x, s.anchor.y, 2.6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(6,8,12,0.72)'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.fillStyle = C.text
    ctx.textBaseline = 'middle'
    ctx.fillText(txt, b.x + fs * 0.4, b.y + h / 2 + 1)
  }
  return [...seen.keys()]
}

/** which muscles of the list can be drawn on this photo (visible segments + view) */
export function visibleMuscles(p: Pose, ids: MuscleId[]): Set<MuscleId> {
  if (!p.ok) return new Set()
  return new Set(buildShapes(p, new Set(ids)).map((s) => s.id))
}

// ---------------- MODE 3: technique ----------------
function drawTechnique(ctx: CanvasRenderingContext2D, p: Pose, o: RenderOpts) {
  const { W, H, pts } = p
  const lw = Math.max(1.4, Math.min(W, H) / 340)
  ctx.save()
  // alignment grid
  ctx.strokeStyle = 'rgba(110,160,255,0.22)'
  ctx.lineWidth = 1
  const step = W / 8
  for (let x = step; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = step; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  // rectilinear guides at the body's visible extremities
  const vp = p.vis.filter((i) => i === 0 || (i >= 11 && i <= 32)).map((i) => pts[i])
  if (vp.length >= 3) {
    const xs = vp.map((q) => q.x), ys = vp.map((q) => q.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    ctx.strokeStyle = BLUE
    ctx.lineWidth = lw * 0.8
    for (const x of [x0, x1]) { ctx.beginPath(); ctx.moveTo(x, y0 - 20); ctx.lineTo(x, y1 + 20); ctx.stroke() }
    for (const y of [y0, y1]) { ctx.beginPath(); ctx.moveTo(x0 - 20, y); ctx.lineTo(x1 + 20, y); ctx.stroke() }
    for (const q of vp) { ctx.beginPath(); ctx.moveTo(q.x - 6, q.y); ctx.lineTo(q.x + 6, q.y); ctx.moveTo(q.x, q.y - 6); ctx.lineTo(q.x, q.y + 6); ctx.stroke() }
  }
  ctx.restore()
  contour(ctx, p, lw)
  // force arrows / paths from the profile (fallback: body line)
  const items = o.profile.technique?.length ? o.profile.technique : [{ type: 'extend' as const, from: 'shM', to: 'far', label: { en: 'LINE', hi: 'लाइन', gu: 'લાઇન' } }]
  const taken = reserveChrome(W, H)
  const fs = Math.round(fsBase(W, H) * 0.78)
  for (const it of items) {
    if (it.type === 'arc') {
      const c = p.named[it.center!], t = p.named[it.through!]
      if (!c || !t) continue
      const r = len(sub(t, c))
      const a = Math.atan2(t.y - c.y, t.x - c.x)
      ctx.strokeStyle = RED
      ctx.lineWidth = lw * 1.5
      ctx.setLineDash([lw * 5, lw * 4])
      ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.08, a - 0.9, a + 0.15); ctx.stroke()
      ctx.setLineDash([])
      const e = a + 0.15
      arrowHead(ctx, { x: c.x + Math.cos(e) * r * 1.08, y: c.y + Math.sin(e) * r * 1.08 }, { x: -Math.sin(e), y: Math.cos(e) }, lw * 7, RED)
      pill(ctx, l3(it.label, o.lang), { x: c.x + Math.cos(a - 0.4) * r * 1.08, y: c.y + Math.sin(a - 0.4) * r * 1.08 }, W, H, taken, fs, '#ffd0cc')
    } else {
      const a = p.named[it.from!], b = p.named[it.to!]
      if (!a || !b || len(sub(b, a)) < 8) continue
      let s = a, e = b
      if (it.type === 'extend') { s = lerp(a, b, 0.0); e = lerp(a, b, 1.25) }
      else { s = lerp(a, b, 0.15); e = lerp(a, b, 0.85) }
      ctx.strokeStyle = RED
      ctx.lineWidth = lw * 2.2
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke()
      arrowHead(ctx, e, sub(e, s), lw * 9, RED)
      pill(ctx, l3(it.label, o.lang), lerp(s, e, 0.5), W, H, taken, fs, '#ffd0cc')
    }
  }
}

function contour(ctx: CanvasRenderingContext2D, p: Pose, lw: number) {
  const { W, H, pts } = p
  const T = p.torsoLen || Math.min(W, H) * 0.2
  const m = document.createElement('canvas')
  m.width = W; m.height = H
  const c = m.getContext('2d')!
  c.fillStyle = '#000'
  c.strokeStyle = '#000'
  c.lineCap = 'round'
  c.lineJoin = 'round'
  const W8: Record<string, number> = { '11-13': 0.24, '12-14': 0.24, '13-15': 0.17, '14-16': 0.17, '23-25': 0.32, '24-26': 0.32, '25-27': 0.22, '26-28': 0.22, '27-31': 0.12, '28-32': 0.12 }
  for (const [a, b] of BONES) {
    const k = `${a}-${b}`
    if (!W8[k] || !pts[a] || !pts[b]) continue
    c.lineWidth = W8[k] * T
    c.beginPath(); c.moveTo(pts[a].x, pts[a].y); c.lineTo(pts[b].x, pts[b].y); c.stroke()
  }
  const quad = [pts[11], pts[12], pts[24], pts[23]]
  if (quad.every(Boolean) && p.view !== 'side') { c.lineWidth = 0.18 * T; c.beginPath(); quad.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); c.stroke() }
  else if (p.named.shM && p.named.hipM) { c.lineWidth = 0.55 * T; c.beginPath(); c.moveTo(p.named.shM.x, p.named.shM.y); c.lineTo(p.named.hipM.x, p.named.hipM.y); c.stroke() }
  if (pts[0]) { c.beginPath(); c.arc(pts[0].x, pts[0].y, 0.26 * T, 0, Math.PI * 2); c.fill() }
  // outline = dilated mask minus mask
  const o = document.createElement('canvas')
  o.width = W; o.height = H
  const oc = o.getContext('2d')!
  const d = Math.max(1.5, lw)
  for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) oc.drawImage(m, dx, dy)
  oc.globalCompositeOperation = 'destination-out'
  oc.drawImage(m, 0, 0)
  oc.globalCompositeOperation = 'source-in'
  oc.fillStyle = RED
  oc.fillRect(0, 0, W, H)
  ctx.drawImage(o, 0, 0)
}
