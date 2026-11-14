/**
 * Muscle overlay renderer. Draws ONLY the anatomical outlines fitted by muscleAnatomy.fitMuscles:
 * solid role colour, fibre striations that follow the muscle, inner edge shading, thin outline,
 * clipped to the person-segmentation mask. There is deliberately no primitive-shape code in this file
 * (scripts/test-anatomy.ts fails the build if one appears).
 */
import type { Lang } from '../types'
import type { P } from './formCheck'
import type { DrawnMuscle, Mask, Role } from './muscleAnatomy'
import { fineName, ROLE_ORDER, roleWord } from './muscleRoles'

export const ROLE_COLOR: Record<Role, { fill: string; line: string; fibre: string; text: string }> = {
  primary: { fill: 'rgba(255,45,38,0.86)', line: 'rgba(120,10,6,0.95)', fibre: 'rgba(90,0,0,0.38)', text: '#ff4a3d' },
  secondary: { fill: 'rgba(255,206,46,0.84)', line: 'rgba(120,86,0,0.95)', fibre: 'rgba(110,70,0,0.36)', text: '#ffd23a' },
  stabilizer: { fill: 'rgba(46,214,122,0.8)', line: 'rgba(0,92,44,0.95)', fibre: 'rgba(0,70,30,0.36)', text: '#3ee08a' },
}
const FONT_MONO = '"JetBrains Mono", "Noto Sans Devanagari", "Noto Sans Gujarati", ui-monospace, monospace'

const mkCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

/** person mask → alpha canvas (soft edge) */
export function maskCanvas(m: Mask): HTMLCanvasElement {
  const c = mkCanvas(m.w, m.h)
  const x = c.getContext('2d')!
  const img = x.createImageData(m.w, m.h)
  for (let i = 0; i < m.w * m.h; i++) {
    const v = m.data[i]
    const a = Math.max(0, Math.min(1, (v - 0.3) / 0.4))
    img.data[i * 4 + 3] = Math.round(a * 255)
  }
  x.putImageData(img, 0, 0)
  return c
}

function polyPath(ctx: CanvasRenderingContext2D, poly: P[]) {
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
}
const area = (poly: P[]) => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y } return Math.abs(a / 2) }

/** greyscale + a little contrast, manual (canvas filter is not supported everywhere) */
export function toBW(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = Math.max(0, Math.min(255, (g - 128) * 1.12 + 120))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}

export function drawMuscleLayer(ctx: CanvasRenderingContext2D, W: number, H: number, muscles: DrawnMuscle[], mask: Mask, occluders: P[][] = []) {
  const layer = mkCanvas(W, H)
  const c = layer.getContext('2d')!
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const fineLw = Math.max(0.8, Math.min(W, H) / 700)
  const trunk = muscles.filter((m) => m.seg === 'torso'), limbs = muscles.filter((m) => m.seg !== 'torso')
  paint(c, trunk, fineLw)
  if (occluders.length) {
    c.globalCompositeOperation = 'destination-out'
    c.fillStyle = '#000'
    for (const o of occluders) { polyPath(c, o); c.fill() }
    c.globalCompositeOperation = 'source-over'
  }
  paint(c, limbs, fineLw)
  // keep everything strictly on the person
  c.globalCompositeOperation = 'destination-in'
  c.imageSmoothingEnabled = true
  c.drawImage(maskCanvas(mask), 0, 0, W, H)
  ctx.drawImage(layer, 0, 0)
}

function paint(c: CanvasRenderingContext2D, muscles: DrawnMuscle[], fineLw: number) {
  for (const m of muscles) {
    const col = ROLE_COLOR[m.role]
    for (const poly of m.polys) {
      if (poly.length < 8) continue
      const size = Math.sqrt(area(poly))
      polyPath(c, poly)
      c.fillStyle = col.fill
      c.fill()
      c.save()
      polyPath(c, poly)
      c.clip()
      // fibre striations (template lines warped with the limb)
      c.strokeStyle = col.fibre
      c.lineWidth = fineLw
      for (const f of m.fibers) {
        c.beginPath()
        c.moveTo(f[0].x, f[0].y)
        for (let i = 1; i < f.length; i++) c.lineTo(f[i].x, f[i].y)
        c.stroke()
      }
      // inner edge shading: the inside half of a wide dark stroke (gives the belly volume, no outer glow)
      polyPath(c, poly)
      c.strokeStyle = 'rgba(0,0,0,0.30)'
      c.lineWidth = Math.max(2, size * 0.22)
      c.stroke()
      polyPath(c, poly)
      c.strokeStyle = 'rgba(0,0,0,0.18)'
      c.lineWidth = Math.max(1, size * 0.09)
      c.stroke()
      c.restore()
      polyPath(c, poly)
      c.strokeStyle = col.line
      c.lineWidth = fineLw * 1.2
      c.stroke()
    }
  }
}

type Box = { x: number; y: number; w: number; h: number }

/** side labels "PRIMARY: BICEPS BRACHII" with leader lines; collision-avoiding per column */
export function drawMuscleLabels(ctx: CanvasRenderingContext2D, W: number, _H: number, muscles: DrawnMuscle[], lang: Lang, centerX: number, zone: { top: number; bottom: number }, max = 6) {
  const fs = Math.round(Math.max(9, Math.min(17, W / 42)))
  ctx.font = `700 ${fs}px ${FONT_MONO}`
  const list = [...muscles].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).slice(0, max)
  const pad = W * 0.03, h = fs * 2.1, gap = fs * 0.45
  const items = list.map((m) => {
    const role = roleWord(m.role, lang).toUpperCase() + ':'
    const name = fineName(m.id, lang).toUpperCase()
    ctx.font = `700 ${fs}px ${FONT_MONO}`
    const rw = ctx.measureText(role + ' ').width
    ctx.font = `600 ${fs}px ${FONT_MONO}`
    let nm = name
    const maxW = W * 0.5
    while (nm.length > 4 && rw + ctx.measureText(nm).width + fs * 1.4 > maxW) nm = nm.slice(0, -1)
    if (nm !== name) nm = nm.trimEnd() + '…'
    const w = rw + ctx.measureText(nm).width + fs * 1.4
    return { m, role, name: nm, rw, w, left: m.anchor.x < centerX }
  })
  const placed: { it: (typeof items)[number]; b: Box }[] = []
  for (const left of [true, false]) {
    const col = items.filter((i) => i.left === left).sort((a, b) => a.m.anchor.y - b.m.anchor.y)
    let y = zone.top
    const boxes: Box[] = []
    for (const it of col) {
      const ty = Math.max(y, Math.min(zone.bottom - h, it.m.anchor.y - h / 2))
      boxes.push({ x: left ? pad : W - pad - it.w, y: ty, w: it.w, h })
      y = ty + h + gap
    }
    // pushed past the bottom: shift the whole column up
    const over = boxes.length ? boxes[boxes.length - 1].y + h - zone.bottom : 0
    if (over > 0) for (const b of boxes) b.y = Math.max(zone.top, b.y - over)
    col.forEach((it, i) => placed.push({ it, b: boxes[i] }))
  }
  for (const { it, b } of placed) {
    const col = ROLE_COLOR[it.m.role]
    const a = it.m.anchor
    const ex = it.left ? b.x + b.w : b.x, ey = b.y + b.h / 2
    const kx = it.left ? Math.min(a.x - fs, ex + fs * 1.2) : Math.max(a.x + fs, ex - fs * 1.2)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = Math.max(1, W / 720)
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(kx, ey); ctx.lineTo(a.x, a.y); ctx.stroke()
    const d = Math.max(3, fs * 0.28)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(a.x - d / 2, a.y - d / 2, d, d)
    ctx.fillStyle = 'rgba(5,7,11,0.86)'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.fillStyle = col.text
    ctx.fillRect(it.left ? b.x : b.x + b.w - 3, b.y, 3, b.h)
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${fs}px ${FONT_MONO}`
    ctx.fillStyle = col.text
    ctx.fillText(it.role, b.x + fs * 0.7, ey + 1)
    ctx.font = `600 ${fs}px ${FONT_MONO}`
    ctx.fillStyle = '#f2f5fa'
    ctx.fillText(it.name, b.x + fs * 0.7 + it.rw, ey + 1)
  }
  return placed.length
}

export function drawLegend(ctx: CanvasRenderingContext2D, W: number, H: number, lang: Lang, roles: Role[]) {
  const fs = Math.round(Math.max(9, Math.min(16, W / 44)))
  ctx.font = `700 ${fs}px ${FONT_MONO}`
  const pad = W * 0.035
  let y = H - pad - roles.length * fs * 1.7
  const w = Math.max(...roles.map((r) => ctx.measureText(roleWord(r, lang).toUpperCase()).width)) + fs * 2.8
  ctx.fillStyle = 'rgba(5,7,11,0.8)'
  ctx.fillRect(pad - fs * 0.5, y - fs * 0.6, w, roles.length * fs * 1.7 + fs * 0.4)
  ctx.textBaseline = 'middle'
  for (const r of roles) {
    ctx.fillStyle = ROLE_COLOR[r].fill
    ctx.fillRect(pad, y, fs, fs)
    ctx.fillStyle = '#e9eef6'
    ctx.fillText(roleWord(r, lang).toUpperCase(), pad + fs * 1.6, y + fs / 2 + 1)
    y += fs * 1.7
  }
}
