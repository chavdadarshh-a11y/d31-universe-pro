/** Canvas overlays for the motion games (thin HUD lines, gold/cyan). Drawn in video pixels; mirroring is done by CSS. */
import { conf, inFrame, type Pt } from './poseFilter'

const SEEN = 0.5
const ok = (p?: Pt) => conf(p) >= SEEN && inFrame(p, 0.005)
const UPPER: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]]
const LOWER: [number, number][] = [[23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]]

export function drawSkeleton(ctx: CanvasRenderingContext2D, lm: Pt[], w: number, h: number, part: 'upper' | 'full', color = 'rgba(255,255,255,0.92)') {
  const lw = Math.max(2, Math.min(w, h) / 150)
  const P = (i: number) => [lm[i].x * w, lm[i].y * h] as const
  ctx.save()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const bones = part === 'full' ? [...UPPER, ...LOWER] : UPPER
  // soft cyan under-stroke + crisp white line (no shadowBlur: cheap on mid-range phones)
  for (const [pass, style, width] of [[0, 'rgba(34,211,238,0.35)', lw * 2.6], [1, color, lw]] as const) {
    void pass
    ctx.strokeStyle = style; ctx.lineWidth = width
    ctx.beginPath()
    for (const [a, b] of bones) {
      if (!ok(lm[a]) || !ok(lm[b])) continue
      const [x1, y1] = P(a), [x2, y2] = P(b)
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
    }
    ctx.stroke()
  }
  const joints = part === 'full' ? [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28] : [11, 12, 13, 14, 15, 16]
  for (const i of joints) {
    if (!ok(lm[i])) continue
    const [x, y] = P(i)
    ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(x, y, lw * 2.1, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, lw * 1.1, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

/** red → yellow → green by depth % (green from `greenAt`) */
export function depthColor(pct: number, greenAt = 100) {
  if (pct >= greenAt) return '#34d399'
  if (pct >= greenAt * 0.55) return '#facc15'
  return '#ef4444'
}

/** squat: translucent torso + thigh shapes, thick hip→knee depth line that turns red → green at parallel */
export function drawSquatOverlay(ctx: CanvasRenderingContext2D, lm: Pt[], w: number, h: number, pct: number, parallel: boolean) {
  const P = (i: number) => [lm[i].x * w, lm[i].y * h] as const
  const lw = Math.max(2, Math.min(w, h) / 150)
  ctx.save()
  const poly = (ids: number[], fill: string) => {
    if (!ids.every((i) => ok(lm[i]))) return
    ctx.fillStyle = fill; ctx.beginPath()
    ids.forEach((i, k) => { const [x, y] = P(i); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
    ctx.closePath(); ctx.fill()
  }
  poly([11, 12, 24, 23], 'rgba(247,197,72,0.16)')
  const col = parallel ? '#34d399' : depthColor(pct)
  for (const [hip, knee] of [[23, 25], [24, 26]]) {
    if (!ok(lm[hip]) || !ok(lm[knee])) continue
    const [x1, y1] = P(hip), [x2, y2] = P(knee)
    // thigh band
    ctx.strokeStyle = parallel ? 'rgba(52,211,153,0.22)' : 'rgba(239,68,68,0.18)'; ctx.lineWidth = lw * 9; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
  // the depth line: across both hips (or hip→knee level marker when side-on)
  const hips = [23, 24].filter((i) => ok(lm[i])), knees = [25, 26].filter((i) => ok(lm[i]))
  if (hips.length && knees.length) {
    const hy = hips.reduce((a, i) => a + lm[i].y, 0) / hips.length * h
    const ky = knees.reduce((a, i) => a + lm[i].y, 0) / knees.length * h
    const xs = [...hips, ...knees].map((i) => lm[i].x * w)
    const x0 = Math.min(...xs) - lw * 10, x1 = Math.max(...xs) + lw * 10
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = lw; ctx.setLineDash([lw * 3, lw * 3])
    ctx.beginPath(); ctx.moveTo(x0, ky); ctx.lineTo(x1, ky); ctx.stroke(); ctx.setLineDash([])
    ctx.strokeStyle = col; ctx.lineWidth = lw * 3.2
    ctx.beginPath(); ctx.moveTo(x0, hy); ctx.lineTo(x1, hy); ctx.stroke()
  }
  ctx.restore()
}
