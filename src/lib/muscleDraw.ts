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

/** YCbCr skin rule (works across skin tones in gym light) */
export function skinClass(R: number, G: number, B: number): 1 | 0 | -1 {
  const Y = 0.299 * R + 0.587 * G + 0.114 * B
  const Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B, Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B
  // dark: only a clearly blue / green garment colour is decided (skin in shadow keeps Cr > Cb)
  if (Y < 30) return Cb > 140 || Cr < 118 ? 0 : -1
  // saturated red / crimson / maroon fabric passes the Cr test; skin (even in red gym light) keeps green at
  // ≥ ~40 % of red, a red shirt sits far below that
  if (R > 40 && G < 0.3 * R) return 0
  // near-white / grey / pale-pink fabric (white shorts, pattern prints): lit, but with almost no skin tint
  if (Y > 90 && Math.hypot(Cb - 128, Cr - 128) < 13) return 0
  return Cr >= 132 && Cr <= 182 && Cb >= 72 && Cb <= 130 ? 1 : 0
}
/**
 * Back views are stricter: a non-skin colour only counts as a garment when it is cold (blue / green / teal,
 * Cr < 130) or neutral grey / black / white. Warm-tinted surfaces stay "skin" — a bare back under purple or
 * red gym light (or with a painted overlay) must never lose its lats.
 */
export function garmentBack(R: number, G: number, B: number): boolean {
  if (skinClass(R, G, B) !== 0) return false
  const Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B, Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B
  return Cr < 130 || (Math.abs(Cb - 128) < 6 && Math.abs(Cr - 128) < 6)
}
/** sampler over the photo (≤360 px grid): 1 skin, 0 clothing / non-skin, -1 too dark to tell (back: garmentBack) */
export function skinSampler(src: CanvasImageSource & { width: number; height: number }, W: number, H: number, back = false): ((x: number, y: number) => number) & { lum?: (x: number, y: number) => number } {
  const k = Math.max(1, Math.ceil(Math.max(W, H) / 360)), gw = Math.ceil(W / k), gh = Math.ceil(H / k)
  const cv = mkCanvas(gw, gh), x = cv.getContext('2d', { willReadFrequently: true })!
  x.imageSmoothingQuality = 'high'
  let d: Uint8ClampedArray
  // each cell is read at 4×4 sub-pixels: its mean colour decides skin / garment, and a strongly mixed cell
  // (a black-white-red print averages to a "skin" brown) says nothing (-1)
  const S = 4
  cv.width = gw * S; cv.height = gh * S
  try { x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, gw * S, gh * S); d = x.getImageData(0, 0, gw * S, gh * S).data } catch { return () => -1 }
  const g = new Int8Array(gw * gh), lumG = new Uint8Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let R = 0, G = 0, B = 0, l = 0, l2 = 0
    for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
      const j = ((gy * S + yy) * gw * S + gx * S + xx) * 4, r = d[j], gg = d[j + 1], b = d[j + 2], L = 0.299 * r + 0.587 * gg + 0.114 * b
      R += r; G += gg; B += b; l += L; l2 += L * L
    }
    const n = S * S; R /= n; G /= n; B /= n
    const sd = Math.sqrt(Math.max(0, l2 / n - (l / n) ** 2))
    const c = skinClass(R, G, B)
    g[gy * gw + gx] = c === 1 && sd > 38 ? -1 : c === 0 && back && !garmentBack(R, G, B) ? 1 : c
    lumG[gy * gw + gx] = Math.round(l / n)
  }
  const at = (px: number, py: number) => { const gx = Math.floor(px / k), gy = Math.floor(py / k); return gx < 0 || gy < 0 || gx >= gw || gy >= gh ? -1 : g[gy * gw + gx] }
  // brightness of a cell (0…255), so the fitter can tell "dark skin in shadow" from "black sleeve on lit skin"
  return Object.assign(at, { lum: (px: number, py: number) => { const gx = Math.floor(px / k), gy = Math.floor(py / k); return gx < 0 || gy < 0 || gx >= gw || gy >= gh ? -1 : lumG[gy * gw + gx] } })
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
function skinCanvas(ctx: CanvasRenderingContext2D, W: number, H: number, mask: Mask, zone: { top: number; bottom: number }, darkLum: number, clothBottom = -1, back = false, px0?: ImageData): HTMLCanvasElement {
  const base = maskCanvas(mask)
  const out = mkCanvas(W, H), o = out.getContext('2d')!
  o.imageSmoothingEnabled = true
  o.drawImage(base, 0, 0, W, H)
  let px: ImageData
  try { px = px0 ?? ctx.getImageData(0, 0, W, H) } catch { return out }
  const k = Math.max(1, Math.ceil(Math.max(W, H) / 360)), gw = Math.ceil(W / k), gh = Math.ceil(H / k)
  const lum = new Float32Array(gw * gh)
  let cloth = new Uint8Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let s = 0, n = 0, R = 0, G = 0, B = 0
    for (let y = gy * k; y < Math.min(H, gy * k + k); y++) for (let x = gx * k; x < Math.min(W, gx * k + k); x++) { const i = (y * W + x) * 4; s += 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2]; R += px.data[i]; G += px.data[i + 1]; B += px.data[i + 2]; n++ }
    lum[gy * gw + gx] = s / (n || 1)
    // clothing (upper body only): a clearly non-skin colour, e.g. a blue tank top (back views: and smooth)
    if ((gy + 0.5) * k < clothBottom && n) {
      cloth[gy * gw + gx] = (back ? garmentBack(R / n, G / n, B / n) : skinClass(R / n, G / n, B / n) === 0) ? 1 : 0
    }
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
  // clothing: drop small blobs (tattoos, skin texture, shadows), keep solid garment areas
  if (clothBottom > 0) {
    cloth = morph(morph(cloth, 2, false), 2, true)
    // and only large connected garment areas count (a tattoo or a dark patch on bare skin is not a shirt)
    const minCells = Math.max(40, Math.round(0.004 * gw * gh)), seen = new Uint8Array(cloth.length), stack: number[] = [], comp: number[] = []
    for (let i0 = 0; i0 < cloth.length; i0++) {
      if (!cloth[i0] || seen[i0]) continue
      comp.length = 0; stack.push(i0); seen[i0] = 1
      while (stack.length) {
        const i = stack.pop()!; comp.push(i)
        const x = i % gw, y = (i - x) / gw
        for (const j of [x > 0 ? i - 1 : -1, x < gw - 1 ? i + 1 : -1, y > 0 ? i - gw : -1, y < gh - 1 ? i + gw : -1]) if (j >= 0 && cloth[j] && !seen[j]) { seen[j] = 1; stack.push(j) }
      }
      if (comp.length < minCells) for (const i of comp) cloth[i] = 0
    }
  }
  // hole mask at grid resolution, scaled up with smoothing (no stair-steps along the hairline)
  const gc = mkCanvas(gw, gh), gx2 = gc.getContext('2d')!, hole = gx2.createImageData(gw, gh)
  let any = false
  for (let gy = 0; gy < gh; gy++) {
    const y = (gy + 0.5) * k
    if (y >= zone.top && y <= zone.bottom) continue
    for (let gx = 0; gx < gw; gx++) if (dk[gy * gw + gx]) { hole.data[(gy * gw + gx) * 4 + 3] = 255; any = true }
  }
  for (let i = 0; i < cloth.length; i++) if (cloth[i]) { hole.data[i * 4 + 3] = 255; any = true }
  if (!any) return out
  gx2.putImageData(hole, 0, 0)
  const hc = mkCanvas(W, H), hx = hc.getContext('2d')!
  hx.imageSmoothingEnabled = true
  hx.drawImage(gc, 0, 0, W, H)
  o.globalCompositeOperation = 'destination-out'
  o.drawImage(hc, 0, 0)
  return out
}

export type SkinOpts = { hairZone?: { top: number; bottom: number }; clothBottom?: number; clothBack?: boolean }
export function drawMuscleLayer(ctx: CanvasRenderingContext2D, W: number, H: number, muscles: DrawnMuscle[], mask: Mask, occluders: P[][] = [], skin: SkinOpts = {}) {
  // read the photo before anything is painted on it
  let px: ImageData | undefined
  try { px = ctx.getImageData(0, 0, W, H) } catch { px = undefined }
  const keep = skin.hairZone || skin.clothBottom ? skinCanvas(ctx, W, H, mask, skin.hairZone ?? { top: -1e9, bottom: 1e9 }, 48, skin.clothBottom ?? -1, !!skin.clothBack, px) : null
  const isLeg = (m: DrawnMuscle) => (m.seg === 'thigh' || m.seg === 'shin') && m.id !== 'glute_max' && m.id !== 'glute_med'
  const legs = skin.clothBottom ? muscles.filter(isLeg) : []
  const layer = mkCanvas(W, H)
  const c = layer.getContext('2d')!
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const fineLw = Math.max(0.8, Math.min(W, H) / 700)
  const byLayer = (a: DrawnMuscle, b: DrawnMuscle) => (a.layer ?? -1) - (b.layer ?? -1)
  // glutes go with the trunk: an arm hanging in front of the hip hides them the same way
  const isGlute = (m: DrawnMuscle) => m.id === 'glute_max' || m.id === 'glute_med'
  const trunk = muscles.filter((m) => m.seg === 'torso' || isGlute(m)).sort(byLayer), limbs = muscles.filter((m) => m.seg !== 'torso' && !isGlute(m) && !legs.includes(m)).sort(byLayer)
  // legs get their own layer clipped to bare skin over the whole photo (shorts / tights are not skin)
  let legLayer: HTMLCanvasElement | null = null
  if (legs.length) {
    legLayer = mkCanvas(W, H)
    const lc = legLayer.getContext('2d')!
    lc.lineJoin = 'round'; lc.lineCap = 'round'
    paint(lc, legs.sort(byLayer), fineLw)
    lc.globalCompositeOperation = 'destination-in'
    lc.drawImage(skinCanvas(ctx, W, H, mask, { top: -1e9, bottom: 1e9 }, 48, H * 2, !!skin.clothBack, px), 0, 0)
    lc.globalCompositeOperation = 'destination-out'
    lc.fillStyle = '#000'
    // arms in front of the thighs (deadlift, RDL hang) hide the leg muscles there
    for (const o of occluders) { polyPath(lc, o); lc.fill() }
    // the glutes sit on top of the hamstrings / quads where they overlap
    for (const m of trunk) if (isGlute(m)) m.polys.forEach((q, i) => { if (!m.apo?.[i] && q.length >= 8) { polyPath(lc, q); lc.fill() } })
    lc.globalCompositeOperation = 'source-over'
  }
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
  c.globalCompositeOperation = 'source-over'
  if (legLayer) { c.globalCompositeOperation = 'destination-over'; c.drawImage(legLayer, 0, 0); c.globalCompositeOperation = 'source-over' }
  dropFragments(c, layer, W, H)
  ctx.drawImage(layer, 0, 0)
  return paintedInfo(layer, W, H, muscles)
}

export type PaintGrid = { k: number; gw: number; gh: number; on: Uint8Array }
/**
 * What is really visible after all clipping: a muscle whose paint was clipped away (on clothing, behind the
 * hair) gets no label, and a label leader points at the painted part (nearest painted cell to its centre),
 * never at a bare shirt. Also returns the painted-cell grid so labels can be placed off the artwork.
 */
function paintedInfo(layer: HTMLCanvasElement, W: number, H: number, muscles: DrawnMuscle[]): { visible: DrawnMuscle[]; grid: PaintGrid | null } {
  const k = Math.max(1, Math.ceil(Math.max(W, H) / 360)), gw = Math.ceil(W / k), gh = Math.ceil(H / k)
  const sm = mkCanvas(gw, gh), sx = sm.getContext('2d', { willReadFrequently: true })!
  sx.drawImage(layer, 0, 0, gw, gh)
  let a: Uint8ClampedArray
  try { a = sx.getImageData(0, 0, gw, gh).data } catch { return { visible: muscles, grid: null } }
  const on = new Uint8Array(gw * gh)
  for (let i = 0; i < on.length; i++) on[i] = a[i * 4 + 3] > 40 ? 1 : 0
  const visible: DrawnMuscle[] = []
  for (const m of muscles) {
    const pts: { x: number; y: number }[] = []
    let tot = 0
    m.polys.forEach((q, pi) => {
      if (m.apo?.[pi] || q.length < 3) return
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
      for (const p of q) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
      for (let gy = Math.max(0, Math.floor(y0 / k)); gy <= Math.min(gh - 1, Math.ceil(y1 / k)); gy++) for (let gx = Math.max(0, Math.floor(x0 / k)); gx <= Math.min(gw - 1, Math.ceil(x1 / k)); gx++) {
        const x = (gx + 0.5) * k, y = (gy + 0.5) * k
        if (!inPoly(q, x, y)) continue
        tot++
        if (on[gy * gw + gx]) pts.push({ x, y })
      }
    })
    // nothing (or only a sliver) of it is on the photo → not labelled
    if (!tot || pts.length < Math.max(6, 0.12 * tot)) continue
    const ce = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length }), { x: 0, y: 0 })
    let best = pts[0], bd = 1e18
    for (const p of pts) { const d = (p.x - ce.x) ** 2 + (p.y - ce.y) ** 2; if (d < bd) { bd = d; best = p } }
    visible.push({ ...m, anchor: { x: best.x, y: best.y } })
  }
  return { visible, grid: { k, gw, gh, on } }
}
function inPoly(poly: P[], x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c
  }
  return c
}

/**
 * After clipping to skin / the body, a muscle can leave tiny disconnected crumbs (a pec tip at a neckline,
 * a sliver between a strap and the armpit). Painted islands that are tiny — absolutely, or next to the
 * biggest painted area — are erased, so only whole, readable muscle shapes stay on the photo.
 */
function dropFragments(c: CanvasRenderingContext2D, layer: HTMLCanvasElement, W: number, H: number) {
  const k = Math.max(1, Math.ceil(Math.max(W, H) / 360)), gw = Math.ceil(W / k), gh = Math.ceil(H / k)
  const sm = mkCanvas(gw, gh), sx = sm.getContext('2d', { willReadFrequently: true })!
  sx.drawImage(layer, 0, 0, gw, gh)
  let a: Uint8ClampedArray
  try { a = sx.getImageData(0, 0, gw, gh).data } catch { return }
  const on = new Uint8Array(gw * gh)
  for (let i = 0; i < on.length; i++) on[i] = a[i * 4 + 3] > 40 ? 1 : 0
  const lab = new Int32Array(gw * gh).fill(-1), sizes: number[] = [], stack: number[] = []
  for (let i0 = 0; i0 < on.length; i0++) {
    if (!on[i0] || lab[i0] >= 0) continue
    const id = sizes.length; let n = 0
    stack.push(i0); lab[i0] = id
    while (stack.length) {
      const i = stack.pop()!; n++
      const x = i % gw, y = (i - x) / gw
      if (x > 0 && on[i - 1] && lab[i - 1] < 0) { lab[i - 1] = id; stack.push(i - 1) }
      if (x < gw - 1 && on[i + 1] && lab[i + 1] < 0) { lab[i + 1] = id; stack.push(i + 1) }
      if (y > 0 && on[i - gw] && lab[i - gw] < 0) { lab[i - gw] = id; stack.push(i - gw) }
      if (y < gh - 1 && on[i + gw] && lab[i + gw] < 0) { lab[i + gw] = id; stack.push(i + gw) }
    }
    sizes.push(n)
  }
  if (sizes.length < 2) return
  const big = Math.max(...sizes), tot = gw * gh
  const drop = sizes.map((n) => n < 0.00035 * tot || (n < 0.03 * big && n < 0.0015 * tot))
  if (!drop.some(Boolean)) return
  const hole = sx.createImageData(gw, gh)
  for (let i = 0; i < lab.length; i++) if (lab[i] >= 0 && drop[lab[i]]) hole.data[i * 4 + 3] = 255
  sx.clearRect(0, 0, gw, gh); sx.putImageData(hole, 0, 0)
  // grow the hole by one grid cell so the soft edge of a crumb goes too
  const hc = mkCanvas(W, H), hx = hc.getContext('2d')!
  hx.imageSmoothingEnabled = true
  for (const [dx, dy] of [[0, 0], [k, 0], [-k, 0], [0, k], [0, -k]]) hx.drawImage(sm, dx, dy, W, H)
  c.save(); c.globalCompositeOperation = 'destination-out'; c.drawImage(hc, 0, 0); c.restore()
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

/** keep fibres whose middles are at least `gap` px apart (evenly thinned, order kept) */
function sparseFibres(lines: P[][], gap: number): P[][] {
  const out: P[][] = []
  let last: P | null = null
  for (const f of lines) {
    if (f.length < 2) continue
    const m = f[Math.floor(f.length / 2)]
    if (!last || Math.hypot(m.x - last.x, m.y - last.y) >= gap) { out.push(f); last = m }
  }
  return out
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
      // this part sits on top: clear what lower muscles painted underneath, so overlaps never stack fibres
      c.save(); c.globalCompositeOperation = 'destination-out'; polyPath(c, poly); c.fillStyle = '#000'; c.fill(); c.restore()
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
      // fine fibre striations: thinned to an even on-screen spacing (no crowding on small parts), one light line each
      const fib = sparseFibres(m.partFibers?.[pi] ?? m.fibers, fineLw * 6)
      c.strokeStyle = 'rgba(60,8,0,0.14)'; c.lineWidth = fineLw * 0.9
      strokeLines(c, fib)
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = fineLw * 0.65
      strokeLines(c, fib)
      // tendinous intersections (rectus abdominis)
      const bands = m.partBands?.[pi]
      if (bands?.length) { c.strokeStyle = 'rgba(255,255,255,0.62)'; c.lineWidth = fineLw * 1.5; strokeLines(c, bands) }
      // soft light inner rim (volume without dark blocks)
      polyPath(c, poly)
      c.strokeStyle = 'rgba(255,255,255,0.16)'
      c.lineWidth = Math.max(2, size * 0.09)
      c.stroke()
      c.restore()
      // thin crisp light outline with a soft glow, over a faint dark line that separates neighbouring muscles
      polyPath(c, poly)
      c.strokeStyle = 'rgba(0,0,0,0.28)'
      c.lineWidth = fineLw * 2.4
      c.stroke()
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
const hit = (a: Box, b: Box, g: number) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h + g && b.y < a.y + a.h + g
/** share (0…1) of the box area that covers painted muscle */
function paintIn(g: PaintGrid, b: Box): number {
  let n = 0, on = 0
  for (let gy = Math.max(0, Math.floor(b.y / g.k)); gy < Math.min(g.gh, Math.ceil((b.y + b.h) / g.k)); gy++) for (let gx = Math.max(0, Math.floor(b.x / g.k)); gx < Math.min(g.gw, Math.ceil((b.x + b.w) / g.k)); gx++) { n++; on += g.on[gy * g.gw + gx] }
  return n ? on / n : 0
}

/** side labels "PRIMARY: BICEPS BRACHII" with leader lines; collision-avoiding per column */
export function drawMuscleLabels(ctx: CanvasRenderingContext2D, W: number, _H: number, muscles: DrawnMuscle[], lang: Lang, centerX: number, zone: { top: number; bottom: number }, max = 6, grid: PaintGrid | null = null) {
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
    // a label box must not hide the artwork: when the stacked column covers painted muscle, re-place each box
    // at the nearest free height (off the paint, not on another box), else keep the stacked spot
    if (grid && boxes.some((b) => paintIn(grid, b) > 0)) {
      const done: Box[] = []
      col.forEach((it, i) => {
        const b = boxes[i], want = Math.max(zone.top, Math.min(zone.bottom - h, it.m.anchor.y - h / 2))
        let best = b.y, bestCost = paintIn(grid, b) * 40 + Math.abs(b.y - want) / h + (done.some((d) => hit(d, b, gap)) ? 1e6 : 0)
        for (let ty = zone.top; ty <= zone.bottom - h; ty += h / 3) {
          const cb = { ...b, y: ty }
          if (done.some((d) => hit(d, cb, gap))) continue
          const cost = paintIn(grid, cb) * 40 + Math.abs(ty - want) / h
          if (cost < bestCost) { bestCost = cost; best = ty }
        }
        b.y = best; done.push(b)
      })
    }
    col.forEach((it, i) => placed.push({ it, b: boxes[i] }))
  }
  // still on the artwork: move that label to the other margin at the nearest free height
  if (grid) for (const pl of placed) {
    if (paintIn(grid, pl.b) < 0.04) continue
    const others = placed.filter((q) => q !== pl).map((q) => q.b)
    const x = pl.it.left ? W - pad - pl.it.w : pad, want = Math.max(zone.top, Math.min(zone.bottom - h, pl.it.m.anchor.y - h / 2))
    let best: Box | null = null, bc = paintIn(grid, pl.b) * 40
    for (let ty = zone.top; ty <= zone.bottom - h; ty += h / 3) {
      const cb = { x, y: ty, w: pl.it.w, h }
      if (others.some((d) => hit(d, cb, gap))) continue
      const cost = paintIn(grid, cb) * 40 + Math.abs(ty - want) / h + 0.5
      if (cost < bc) { bc = cost; best = cb }
    }
    if (best) { pl.b = best; pl.it = { ...pl.it, left: !pl.it.left } }
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
