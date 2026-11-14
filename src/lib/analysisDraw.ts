/**
 * Canvas renderers for the Analyze result "slide": photo + one of three overlays
 * (angles / muscles / technique) + condensed title + mono spec box.
 * Everything is anchored to clearly visible body points only (Pose.pts).
 * Muscles: ONLY anatomical outlines fitted to the body contour (muscleAnatomy + muscleDraw). Nothing else.
 */
import type { Lang, MuscleId } from '../types'
import { l3, metricLabel, type Mode, type P, type Pose, type Profile } from './formCheck'
import type { DrawnMuscle, Mask, Role } from './muscleAnatomy'
import { drawLegend, drawMuscleLabels, drawMuscleLayer, toBW } from './muscleDraw'

const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]]
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y })
const mul = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k })
const len = (a: P) => Math.hypot(a.x, a.y)
const norm = (a: P): P => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l } }
const perp = (a: P): P => ({ x: -a.y, y: a.x })
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

const FONT_TITLE = '"Oswald", "Noto Sans Devanagari", "Noto Sans Gujarati", Impact, sans-serif'
const FONT_MONO = '"JetBrains Mono", "Noto Sans Devanagari", "Noto Sans Gujarati", ui-monospace, monospace'
const RED = '#ff3b30'
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
  /** fitted anatomical muscles + the person mask they are clipped to (muscles mode) */
  anatomy?: { drawn: DrawnMuscle[]; mask: Mask | null; roles: Role[]; occluders?: P[][] }
  /** black & white photo underneath */
  bw?: boolean
  /** muscle labels + legend even without chrome (poster) */
  labels?: boolean
}

export function renderAnalysis(canvas: HTMLCanvasElement, src: CanvasImageSource, pose: Pose, o: RenderOpts) {
  const W = pose.W, H = pose.H
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, W, H)
  if (o.bw) toBW(ctx, W, H)
  ctx.fillStyle = o.mode === 'muscles' ? 'rgba(4,6,10,0.12)' : 'rgba(4,6,10,0.22)'
  ctx.fillRect(0, 0, W, H)
  let drawn: DrawnMuscle[] = []
  if (pose.ok) {
    if (o.mode === 'technique') drawTechnique(ctx, pose, o)
    else if (o.mode === 'muscles') {
      const a = o.anatomy
      if (a?.mask && a.drawn.length) {
        drawMuscleLayer(ctx, W, H, a.drawn, a.mask, a.occluders)
        drawn = a.drawn
      }
    } else drawAngles(ctx, pose, o)
  }
  const chrome = o.chrome !== false
  if (chrome) drawTitle(ctx, W, H, o.title, o.subtitle)
  if ((chrome || o.labels) && o.mode === 'muscles' && drawn.length) {
    const cx = pose.named.shM && pose.named.hipM ? (pose.named.shM.x + pose.named.hipM.x) / 2 : W / 2
    drawMuscleLabels(ctx, W, H, drawn, o.lang, cx, chrome ? { top: H * 0.2, bottom: H * 0.76 } : { top: H * 0.03, bottom: H * 0.86 })
    if (o.anatomy?.roles.length) drawLegend(ctx, W, H, o.lang, o.anatomy.roles)
  }
  if (chrome) drawSpec(ctx, W, H, o.spec)
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
