/**
 * Muscle overlay renderer. Draws ONLY the anatomical outlines fitted by muscleAnatomy.fitMuscles:
 * solid role colour, fibre striations that follow the muscle, inner edge shading, thin outline,
 * clipped to the person-segmentation mask. There is deliberately no primitive-shape code in this file
 * (scripts/test-anatomy.ts fails the build if one appears).
 */
import type { Lang } from '../types'
import type { P, Pose } from './formCheck'
import type { DrawnMuscle, Mask, Role } from './muscleAnatomy'
import { fineName, ROLE_ORDER, roleWord } from './muscleRoles'

export const ROLE_COLOR: Record<Role, { fill: string; line: string; fibre: string; text: string }> = {
  primary: { fill: 'rgba(255,45,38,0.86)', line: 'rgba(120,10,6,0.95)', fibre: 'rgba(90,0,0,0.38)', text: '#ff4a3d' },
  secondary: { fill: 'rgba(255,206,46,0.84)', line: 'rgba(120,86,0,0.95)', fibre: 'rgba(110,70,0,0.36)', text: '#ffd23a' },
  stabilizer: { fill: 'rgba(46,214,122,0.8)', line: 'rgba(0,92,44,0.95)', fibre: 'rgba(0,70,30,0.36)', text: '#3ee08a' },
}
const FONT_MONO = '"JetBrains Mono", "Noto Sans Devanagari", "Noto Sans Gujarati", ui-monospace, monospace'

const mkCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

/**
 * Face cue for the front/back decision: the pixels between the eyes and the nose are skin when the person
 * faces the camera and hair when their back is turned. 'skin' | 'dark' | undefined (can't tell).
 */
export function faceCue(src: CanvasImageSource & { width: number; height: number }, pose: Pose): 'skin' | 'dark' | undefined {
  const P = pose.pts
  if (!pose.ok || !P[0] || !P[2] || !P[5]) return undefined
  const c = { x: (P[0].x + P[2].x + P[5].x) / 3, y: (P[0].y + P[2].y + P[5].y) / 3 }, r = Math.max(3, 0.6 * Math.hypot(P[2].x - P[5].x, P[2].y - P[5].y))
  const n = Math.ceil(2 * r), cv = mkCanvas(n, n), x = cv.getContext('2d', { willReadFrequently: true })!
  const sw = (src as HTMLImageElement).naturalWidth || src.width, sh = (src as HTMLImageElement).naturalHeight || src.height
  const kx = sw / pose.W, ky = sh / pose.H
  try { x.drawImage(src, (c.x - r) * kx, (c.y - r) * ky, 2 * r * kx, 2 * r * ky, 0, 0, n, n) } catch { return undefined }
  const d = x.getImageData(0, 0, n, n).data
  let cnt = 0, lum = 0, skin = 0
  for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
    if ((xx + 0.5 - r) ** 2 + (yy + 0.5 - r) ** 2 > r * r) continue
    const i = (yy * n + xx) * 4, R = d[i], G = d[i + 1], B = d[i + 2], l = 0.299 * R + 0.587 * G + 0.114 * B
    cnt++; lum += l
    if (R > G && G > B && R - B > 12 && l > 55) skin++
  }
  if (!cnt) return undefined
  lum /= cnt; skin /= cnt
  if (lum < 45 && skin < 0.15) return 'dark'
  if (skin >= 0.3 && lum >= 50) return 'skin'
  return undefined
}

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


/**
 * Hair / dark clothing: very dark pixels inside the person mask are not skin, so no muscle is painted there.
 * Only applied outside the zone [top, bottom] (the app uses: above the neck base = hair) — on the torso a dark pixel is a
 * shadow on skin and must keep its muscle. Works on a ≤360 px grid; returns an alpha canvas (W×H).
 */
function skinCanvas(ctx: CanvasRenderingContext2D, W: number, H: number, mask: Mask, zone: { top: number; bottom: number }, darkLum: number): HTMLCanvasElement {
  const base = maskCanvas(mask)
  const out = mkCanvas(W, H), o = out.getContext('2d')!
  o.imageSmoothingEnabled = true
  o.drawImage(base, 0, 0, W, H)
  let px: ImageData
  try { px = ctx.getImageData(0, 0, W, H) } catch { return out }
  const k = Math.max(1, Math.ceil(Math.max(W, H) / 360)), gw = Math.ceil(W / k), gh = Math.ceil(H / k)
  const lum = new Float32Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let s = 0, n = 0
    for (let y = gy * k; y < Math.min(H, gy * k + k); y++) for (let x = gx * k; x < Math.min(W, gx * k + k); x++) { const i = (y * W + x) * 4; s += 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2]; n++ }
    lum[gy * gw + gx] = s / (n || 1)
  }
  // blur (r≈2 px of the photo), threshold, erode then dilate (drops thin dark lines such as skin creases)
  const box = (a: Float32Array, r: number) => {
    const t = new Float32Array(a.length), u = new Float32Array(a.length)
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < gw) { s += a[y * gw + xx]; n++ } } t[y * gw + x] = s / n }
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < gh) { s += t[yy * gw + x]; n++ } } u[y * gw + x] = s / n }
    return u
  }
  const morph = (a: Uint8Array, r: number, max: boolean) => {
    const t = new Uint8Array(a.length), u = new Uint8Array(a.length)
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let v = max ? 0 : 1; for (let d = -r; d <= r; d++) { const xx = Math.min(gw - 1, Math.max(0, x + d)); v = max ? v | a[y * gw + xx] : v & a[y * gw + xx] } t[y * gw + x] = v }
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let v = max ? 0 : 1; for (let d = -r; d <= r; d++) { const yy = Math.min(gh - 1, Math.max(0, y + d)); v = max ? v | t[yy * gw + x] : v & t[yy * gw + x] } u[y * gw + x] = v }
    return u
  }
  const r = Math.max(1, Math.round(2 / k))
  const bl = box(lum, r)
  let dk = new Uint8Array(gw * gh)
  for (let i = 0; i < dk.length; i++) dk[i] = bl[i] < darkLum ? 1 : 0
  dk = morph(morph(dk, Math.max(1, Math.round(2 / k)), false), Math.max(1, Math.round(4 / k)), true)
  // hole mask at grid resolution, scaled up with smoothing (no stair-steps along the hairline)
  const gc = mkCanvas(gw, gh), gx2 = gc.getContext('2d')!, hole = gx2.createImageData(gw, gh)
  let any = false
  for (let gy = 0; gy < gh; gy++) {
    const y = (gy + 0.5) * k
    if (y >= zone.top && y <= zone.bottom) continue
    for (let gx = 0; gx < gw; gx++) if (dk[gy * gw + gx]) { hole.data[(gy * gw + gx) * 4 + 3] = 255; any = true }
  }
  if (!any) return out
  gx2.putImageData(hole, 0, 0)
  const hc = mkCanvas(W, H), hx = hc.getContext('2d')!
  hx.imageSmoothingEnabled = true
  hx.drawImage(gc, 0, 0, W, H)
  o.globalCompositeOperation = 'destination-out'
  o.drawImage(hc, 0, 0)
  return out
}

export type SkinOpts = { hairZone?: { top: number; bottom: number } }
export function drawMuscleLayer(ctx: CanvasRenderingContext2D, W: number, H: number, muscles: DrawnMuscle[], mask: Mask, occluders: P[][] = [], skin: SkinOpts = {}) {
  // read the photo before anything is painted on it
  const keep = skin.hairZone ? skinCanvas(ctx, W, H, mask, skin.hairZone, 48) : null
  const layer = mkCanvas(W, H)
  const c = layer.getContext('2d')!
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const fineLw = Math.max(0.8, Math.min(W, H) / 700)
  const byLayer = (a: DrawnMuscle, b: DrawnMuscle) => (a.layer ?? -1) - (b.layer ?? -1)
  const trunk = muscles.filter((m) => m.seg === 'torso').sort(byLayer), limbs = muscles.filter((m) => m.seg !== 'torso').sort(byLayer)
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
  if (keep) c.drawImage(keep, 0, 0)
  else c.drawImage(maskCanvas(mask), 0, 0, W, H)
  ctx.drawImage(layer, 0, 0)
}

const strokeLines = (c: CanvasRenderingContext2D, lines: P[][]) => {
  for (const f of lines) {
    if (f.length < 2) continue
    c.beginPath()
    c.moveTo(f[0].x, f[0].y)
    for (let i = 1; i < f.length; i++) c.lineTo(f[i].x, f[i].y)
    c.stroke()
  }
}
const centroid = (poly: P[]) => poly.reduce((a, b) => ({ x: a.x + b.x / poly.length, y: a.y + b.y / poly.length }), { x: 0, y: 0 })

/** heat ramps (core → edge): primary = red-dominant, secondary = amber/yellow, stabilizer = green */
const HEAT: Record<Role, [number, string][]> = {
  primary: [[0, 'rgba(255,214,92,0.86)'], [0.17, 'rgba(255,122,30,0.8)'], [0.45, 'rgba(236,34,24,0.62)'], [0.75, 'rgba(214,30,30,0.22)'], [1, 'rgba(214,30,30,0)']],
  secondary: [[0, 'rgba(255,246,168,0.82)'], [0.3, 'rgba(255,202,40,0.68)'], [0.66, 'rgba(255,172,30,0.26)'], [1, 'rgba(255,172,30,0)']],
  stabilizer: [[0, 'rgba(206,255,196,0.74)'], [0.34, 'rgba(72,222,122,0.58)'], [0.7, 'rgba(40,190,110,0.22)'], [1, 'rgba(40,190,110,0)']],
}
/** principal axes of an outline (for an elongated heat core that follows the muscle belly) */
function axes(poly: P[]) {
  const ce = centroid(poly)
  let xx = 0, yy = 0, xy = 0
  for (const p of poly) { const dx = p.x - ce.x, dy = p.y - ce.y; xx += dx * dx; yy += dy * dy; xy += dx * dy }
  xx /= poly.length; yy /= poly.length; xy /= poly.length
  const tr = xx + yy, det = xx * yy - xy * xy, l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = Math.max(1e-6, tr - l1)
  return { ce, ang: 0.5 * Math.atan2(2 * xy, xx - yy), a: Math.sqrt(l1), b: Math.sqrt(l2) }
}

function paint(c: CanvasRenderingContext2D, muscles: DrawnMuscle[], fineLw: number) {
  for (const m of muscles) {
    const heat = HEAT[m.role]
    m.polys.forEach((poly, pi) => {
      if (poly.length < 8) return
      const size = Math.sqrt(area(poly))
      if (m.apo?.[pi]) {
        // tendon sheet / aponeurosis: a faint pale sheet with a dashed light edge, no heat, no fibres
        polyPath(c, poly); c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill()
        c.save(); c.setLineDash([fineLw * 3, fineLw * 2]); polyPath(c, poly); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = fineLw * 0.9; c.stroke(); c.restore()
        return
      }
      c.save()
      polyPath(c, poly)
      c.clip()
      // translucent pale sheen: the skin stays visible through the muscle
      c.fillStyle = 'rgba(226,236,255,0.2)'
      c.fillRect(-1e5, -1e5, 2e5, 2e5)
      // heat: hot core on the belly fading to the edges (follows the muscle's long axis)
      const ax = axes(poly)
      c.save()
      c.translate(ax.ce.x, ax.ce.y); c.rotate(ax.ang); c.scale(ax.a * 1.55, ax.b * 1.55)
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      for (const [o, col] of heat) g.addColorStop(o, col)
      c.fillStyle = g
      c.fillRect(-2, -2, 4, 4)
      c.restore()
      // fine fibre striations (light, plus a faint darker line for depth)
      const fib = m.partFibers?.[pi] ?? m.fibers
      c.strokeStyle = 'rgba(70,10,0,0.16)'; c.lineWidth = fineLw * 0.8
      strokeLines(c, fib)
      c.strokeStyle = 'rgba(255,255,255,0.26)'; c.lineWidth = fineLw * 0.55
      c.save(); c.translate(fineLw * 0.7, fineLw * 0.7); strokeLines(c, fib); c.restore()
      // tendinous intersections (rectus abdominis)
      const bands = m.partBands?.[pi]
      if (bands?.length) { c.strokeStyle = 'rgba(255,255,255,0.62)'; c.lineWidth = fineLw * 1.5; strokeLines(c, bands) }
      // soft light inner rim (volume without dark blocks)
      polyPath(c, poly)
      c.strokeStyle = 'rgba(255,255,255,0.16)'
      c.lineWidth = Math.max(2, size * 0.09)
      c.stroke()
      c.restore()
      // thin crisp light outline with a soft glow
      c.save()
      c.shadowColor = 'rgba(255,255,255,0.55)'
      c.shadowBlur = fineLw * 3
      polyPath(c, poly)
      c.strokeStyle = 'rgba(236,244,255,0.9)'
      c.lineWidth = fineLw * 1.05
      c.stroke()
      c.restore()
    })
  }
}

type Box = { x: number; y: number; w: number; h: number }

/** side labels "PRIMARY: BICEPS BRACHII" with leader lines; collision-avoiding per column */
export function drawMuscleLabels(ctx: CanvasRenderingContext2D, W: number, _H: number, muscles: DrawnMuscle[], lang: Lang, centerX: number, zone: { top: number; bottom: number }, max = 6) {
  const fs = Math.round(Math.max(9, Math.min(17 * Math.max(1, Math.min(W, _H) / 700), W / 42)))
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
  const fs = Math.round(Math.max(9, Math.min(16 * Math.max(1, Math.min(W, H) / 700), W / 44)))
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
