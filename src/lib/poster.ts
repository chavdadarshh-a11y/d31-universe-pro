/**
 * "D31 poster" export (1080×1920) + the data used by the on-screen HUD panels.
 * Every number on it comes from the measured photo; muscle activation is the TYPICAL role only
 * (shown as qualitative Primary / Secondary / Stabilizer bars, explicitly labelled "not measured").
 */
import type { Lang } from '../types'
import { l3, metricLabel, type CheckResult, type Pose, type Profile } from './formCheck'
import type { DrawnMuscle, Fine, NotDrawn, Role } from './muscleAnatomy'
import { ROLE_COLOR } from './muscleDraw'
import { fineName, ROLE_ORDER, roleWord } from './muscleRoles'

export const ROLE_LEVEL: Record<Role, number> = { primary: 1, secondary: 2 / 3, stabilizer: 1 / 3 }

export type Hud = {
  gauge: { label: string; value: number } | null
  angles: { label: string; value: string }[]
  path: string[]
  form: { ok: boolean; text: string }[]
  muscles: { id: Fine; role: Role; name: string; drawn: boolean }[]
}

export function hudData(pose: Pose | null, checks: CheckResult[], profile: Profile, drawn: DrawnMuscle[], notDrawn: NotDrawn[], lang: Lang): Hud {
  const deg = checks.filter((c) => /°$/.test(c.value))
  // gauge: the first angle rule on the photo, else the first measured profile angle
  let gauge: Hud['gauge'] = null
  if (pose?.ok) {
    const m = deg[0]?.metric ?? profile.angles.find((k) => pose.metrics[k])
    if (m && pose.metrics[m]) gauge = { label: metricLabel(m, lang), value: pose.metrics[m].v }
  }
  const angles = deg.slice(0, 4).map((c) => ({ label: c.label, value: c.value }))
  if (!angles.length && pose?.ok) for (const k of profile.angles) if (pose.metrics[k]) angles.push({ label: metricLabel(k, lang), value: `${Math.round(pose.metrics[k].v)}°` })
  const form = checks.filter((c) => c.msg).sort((a, b) => (a.status === 'ok' ? 1 : 0) - (b.status === 'ok' ? 1 : 0)).slice(0, 4).map((c) => ({ ok: c.status === 'ok', text: `${c.label}: ${c.msg}` }))
  const muscles = [...drawn.map((m) => ({ id: m.id, role: m.role, drawn: true })), ...notDrawn.map((m) => ({ id: m.id, role: m.role, drawn: false }))]
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    .map((m) => ({ ...m, name: fineName(m.id, lang) }))
  const path = profile.cues.slice(0, 3).map((c) => l3(c, lang))
  if (!path.length && l3(profile.focus, lang)) path.push(l3(profile.focus, lang))
  return { gauge, angles, path, form, muscles }
}

const FT = '"Oswald", "Noto Sans Devanagari", "Noto Sans Gujarati", Impact, sans-serif'
const FM = '"JetBrains Mono", "Noto Sans Devanagari", "Noto Sans Gujarati", ui-monospace, monospace'
const RED = '#ff3b30'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/), out: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w } else cur = t
    if (out.length === maxLines) break
  }
  if (cur && out.length < maxLines) out.push(cur)
  if (out.length === maxLines && words.join(' ').length > out.join(' ').length) out[maxLines - 1] = out[maxLines - 1].replace(/.{0,2}$/, '…')
  return out
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string, n: string) {
  ctx.fillStyle = 'rgba(12,16,24,0.92)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
  // corner ticks
  ctx.strokeStyle = RED
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(x, y + 22); ctx.lineTo(x, y); ctx.lineTo(x + 22, y); ctx.stroke()
  ctx.font = `700 22px ${FM}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = RED
  ctx.fillText(n, x + 18, y + 16)
  ctx.fillStyle = '#f3f6fb'
  ctx.fillText(title.toUpperCase(), x + 18 + ctx.measureText(n + '  ').width, y + 16)
}

export type PosterInput = {
  overlay: HTMLCanvasElement
  bodyMap?: HTMLImageElement | null
  hud: Hud
  title: string
  lang: Lang
  t: (k: string) => string
  date: string
}

export function renderPoster(p: PosterInput): HTMLCanvasElement {
  const W = 1080, H = 1920
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, W, H)
  // HUD grid
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  // header
  ctx.textBaseline = 'top'
  ctx.font = `700 24px ${FM}`
  ctx.fillStyle = RED
  ctx.fillText('D31.UNIVERSE', 48, 44)
  ctx.fillStyle = '#9aa4b5'
  ctx.fillText(` · ${p.t('posterTag').toUpperCase()}`, 48 + ctx.measureText('D31.UNIVERSE').width, 44)
  ctx.font = `700 76px ${FT}`
  ctx.fillStyle = '#ffffff'
  const tl = wrap(ctx, p.title.toUpperCase(), W - 96, 2)
  tl.forEach((l, i) => ctx.fillText(l, 48, 84 + i * 78))
  const top = 84 + tl.length * 78 + 18
  ctx.fillStyle = RED; ctx.fillRect(48, top, 140, 5)

  // photo with overlay (contain)
  const boxY = top + 26, boxH = 1060 - boxY, boxW = W - 96
  const o = p.overlay, k = Math.min(boxW / o.width, boxH / o.height)
  const dw = o.width * k, dh = o.height * k, dx = 48 + (boxW - dw) / 2, dy = boxY + (boxH - dh) / 2
  ctx.fillStyle = '#000'; ctx.fillRect(48, boxY, boxW, boxH)
  ctx.drawImage(o, dx, dy, dw, dh)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(48, boxY, boxW, boxH)

  // panels
  const py = 1080, gap = 20, colW = (W - 96 - gap) / 2
  const h1 = 370, h2 = 240
  // 01 target muscles
  panel(ctx, 48, py, colW, h1, p.t('hudTarget'), '01')
  if (p.bodyMap) {
    const bk = Math.min((colW - 36) / p.bodyMap.naturalWidth, (h1 - 150) / p.bodyMap.naturalHeight)
    ctx.drawImage(p.bodyMap, 48 + (colW - p.bodyMap.naturalWidth * bk) / 2, py + 56, p.bodyMap.naturalWidth * bk, p.bodyMap.naturalHeight * bk)
  }
  ctx.font = `600 21px ${FM}`
  const prim = p.hud.muscles.filter((m) => m.role === 'primary').slice(0, 3)
  prim.forEach((m, i) => {
    ctx.fillStyle = ROLE_COLOR.primary.text
    ctx.fillRect(66, py + h1 - 88 + i * 28 + 6, 12, 12)
    ctx.fillStyle = '#e9eef6'
    ctx.fillText(m.name.toUpperCase(), 88, py + h1 - 88 + i * 28)
  })
  // 02 joint angles (est.) gauge
  const gx = 48 + colW + gap
  panel(ctx, gx, py, colW, h1, p.t('hudAngles'), '02')
  if (p.hud.gauge) {
    const cx = gx + colW / 2, cy = py + 270, R = Math.min(colW * 0.36, 150)
    ctx.lineCap = 'butt'
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 22
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI); ctx.stroke()
    const v = Math.max(0, Math.min(180, p.hud.gauge.value))
    ctx.strokeStyle = RED
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI + (v / 180) * Math.PI); ctx.stroke()
    // ticks every 30°
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2
    for (let a = 0; a <= 180; a += 30) {
      const r = Math.PI + (a / 180) * Math.PI
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(r) * (R + 16), cy + Math.sin(r) * (R + 16)); ctx.lineTo(cx + Math.cos(r) * (R + 26), cy + Math.sin(r) * (R + 26)); ctx.stroke()
    }
    const na = Math.PI + (v / 180) * Math.PI
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (R - 24), cy + Math.sin(na) * (R - 24)); ctx.stroke()
    ctx.textAlign = 'center'
    ctx.font = `700 64px ${FT}`; ctx.fillStyle = '#ffffff'
    ctx.fillText(`${Math.round(p.hud.gauge.value)}°`, cx, cy + 10)
    ctx.font = `600 20px ${FM}`; ctx.fillStyle = '#9aa4b5'
    ctx.fillText(`${p.hud.gauge.label.toUpperCase()} · EST.`, cx, cy + 84)
    ctx.textAlign = 'left'
    p.hud.angles.slice(1, 3).forEach((a, i) => { ctx.fillStyle = '#cfd6e2'; ctx.fillText(`${a.label.toUpperCase()}: ${a.value}`, gx + 24, py + 70 + i * 28) })
  } else {
    ctx.font = `600 22px ${FM}`; ctx.fillStyle = '#9aa4b5'
    wrap(ctx, p.t('hudNoAngle'), colW - 48, 4).forEach((l, i) => ctx.fillText(l, gx + 24, py + 90 + i * 32))
  }
  // 03 movement path + 04 key form points
  const py2 = py + h1 + gap
  panel(ctx, 48, py2, colW, h2, p.t('hudPath'), '03')
  ctx.font = `600 21px ${FM}`
  let yy = py2 + 64
  for (const cue of p.hud.path) {
    ctx.strokeStyle = RED; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(66, yy + 20); ctx.quadraticCurveTo(76, yy, 90, yy + 6); ctx.stroke()
    ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(96, yy + 8); ctx.lineTo(84, yy + 1); ctx.lineTo(86, yy + 13); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#e9eef6'
    for (const l of wrap(ctx, cue.toUpperCase(), colW - 90, 2)) { ctx.fillText(l, 108, yy); yy += 28 }
    yy += 12
  }
  panel(ctx, gx, py2, colW, h2, p.t('hudForm'), '04')
  yy = py2 + 64
  if (!p.hud.form.length) { ctx.fillStyle = '#9aa4b5'; wrap(ctx, p.t('hudNoForm'), colW - 48, 3).forEach((l) => { ctx.fillText(l, gx + 24, yy); yy += 30 }) }
  for (const f of p.hud.form) {
    ctx.fillStyle = f.ok ? '#34d399' : '#f5b942'
    ctx.font = `700 22px ${FM}`
    ctx.fillText(f.ok ? '✓' : '!', gx + 24, yy)
    ctx.font = `500 19px ${FM}`
    ctx.fillStyle = '#e9eef6'
    for (const l of wrap(ctx, f.text, colW - 80, 3)) { ctx.fillText(l, gx + 56, yy); yy += 25 }
    yy += 10
    if (yy > py2 + h2 - 40) break
  }
  // 05 muscle activation (qualitative: typical role, never a measured %)
  const py3 = py2 + h2 + gap, h3 = 150
  panel(ctx, 48, py3, W - 96, h3, p.t('hudActivation'), '05')
  ctx.font = `500 15px ${FM}`; ctx.fillStyle = '#7d8798'
  ctx.textAlign = 'right'; ctx.fillText(p.t('typicalRole').toUpperCase(), W - 66, py3 + 20); ctx.textAlign = 'left'
  p.hud.muscles.slice(0, 6).forEach((m, i) => {
    const cw = (W - 132) / 3, bx = 66 + (i % 3) * cw, by = py3 + 52 + Math.floor(i / 3) * 48, bw = cw - 28
    ctx.font = `600 16px ${FM}`; ctx.fillStyle = '#cfd6e2'
    let nm = m.name.toUpperCase()
    while (nm.length > 4 && ctx.measureText(nm).width > bw - 4) nm = nm.slice(0, -1)
    ctx.fillText(nm, bx, by)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(bx, by + 24, bw, 8)
    ctx.fillStyle = ROLE_COLOR[m.role].text; ctx.fillRect(bx, by + 24, bw * ROLE_LEVEL[m.role], 8)
  })
  // footer
  ctx.font = `700 20px ${FM}`; ctx.fillStyle = '#9aa4b5'
  ctx.fillText(p.t('posterFooter').toUpperCase(), 48, H - 34)
  ctx.textAlign = 'right'; ctx.fillText(p.date, W - 48, H - 34); ctx.textAlign = 'left'
  void roleWord
  return c
}

/** Rasterise an on-screen SVG (body map) for the poster */
export async function svgToImage(svg: SVGSVGElement | null): Promise<HTMLImageElement | null> {
  if (!svg) return null
  const clone = svg.cloneNode(true) as SVGSVGElement
  const r = svg.getBoundingClientRect()
  clone.setAttribute('width', String(Math.round(r.width * 2)))
  clone.setAttribute('height', String(Math.round(r.height * 2)))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone))
  const img = new Image()
  img.src = url
  try { await img.decode(); return img } catch { return null }
}

export async function sharePoster(c: HTMLCanvasElement, name: string): Promise<'shared' | 'downloaded'> {
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title: 'D31.UNIVERSE' }); return 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return 'shared' }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'downloaded'
}
