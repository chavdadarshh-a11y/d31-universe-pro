/**
 * "Aaj ka workout done" share card — drawn on a canvas on the phone (1080×1920, story size).
 * Only real numbers: today's date, the user's own streak and today's plan. Shared with the Web Share API
 * (WhatsApp / Instagram story pick it up as an image); otherwise the image is downloaded.
 */
export type CardData = { headline: string; streakText: string; sub: string; dateText: string; site: string; week: boolean[] }

const W = 1080, H = 1920
const FONT = '"Orbitron","Space Grotesk","Inter","Noto Sans Devanagari","Noto Sans Gujarati",system-ui,sans-serif'
const BODY = '"Inter","Noto Sans Devanagari","Noto Sans Gujarati",system-ui,sans-serif'

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src })
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, font: string, weight = 800) {
  let s = size
  do { ctx.font = `${weight} ${s}px ${font}`; s -= 4 } while (ctx.measureText(text).width > max && s > 28)
}

export async function drawShareCard(d: CardData): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  // background: deep night with gold + cyan glows
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#05070d'); bg.addColorStop(0.55, '#0a1220'); bg.addColorStop(1, '#04060b')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, col: string) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H) }
  glow(170, 260, 700, 'rgba(247,197,72,0.28)')
  glow(940, 1500, 760, 'rgba(34,211,238,0.24)')
  // HUD grid
  ctx.strokeStyle = 'rgba(34,211,238,0.06)'; ctx.lineWidth = 2
  for (let x = 0; x <= W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  // frame
  const grad = ctx.createLinearGradient(60, 0, W - 60, 0); grad.addColorStop(0, '#f7c548'); grad.addColorStop(1, '#22d3ee')
  ctx.strokeStyle = grad; ctx.lineWidth = 6
  ctx.beginPath(); ctx.roundRect(54, 54, W - 108, H - 108, 48); ctx.stroke()
  // logo
  const logo = await loadImg(`${import.meta.env.BASE_URL}icons/icon-512.png`)
  if (logo) { ctx.save(); ctx.shadowColor = 'rgba(247,197,72,0.7)'; ctx.shadowBlur = 60; ctx.drawImage(logo, W / 2 - 110, 170, 220, 220); ctx.restore() }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f7c548'; ctx.font = `800 54px ${FONT}`; ctx.fillText('D31.UNIVERSE', W / 2, 470)
  ctx.fillStyle = 'rgba(103,232,249,0.85)'; ctx.font = `600 30px ${BODY}`; ctx.fillText(d.dateText, W / 2, 530)
  // check badge
  ctx.save(); ctx.translate(W / 2, 760)
  ctx.shadowColor = 'rgba(34,211,238,0.8)'; ctx.shadowBlur = 50
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.stroke()
  ctx.shadowBlur = 0; ctx.strokeStyle = '#f7c548'; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(-58, 4); ctx.lineTo(-14, 50); ctx.lineTo(66, -46); ctx.stroke(); ctx.restore()
  // headline
  ctx.fillStyle = '#ffffff'; fit(ctx, d.headline, W - 200, 96, FONT); ctx.fillText(d.headline, W / 2, 1040)
  // streak
  const sg = ctx.createLinearGradient(240, 0, W - 240, 0); sg.addColorStop(0, '#f7c548'); sg.addColorStop(1, '#fb923c')
  ctx.fillStyle = sg; fit(ctx, d.streakText, W - 220, 120, FONT, 900); ctx.fillText(d.streakText, W / 2, 1210)
  // week strip (real days)
  const n = d.week.length, size = 74, gap = 26, x0 = W / 2 - (n * size + (n - 1) * gap) / 2
  d.week.forEach((on, i) => {
    const x = x0 + i * (size + gap)
    ctx.beginPath(); ctx.roundRect(x, 1290, size, size, 20)
    if (on) { ctx.fillStyle = 'rgba(34,211,238,0.9)'; ctx.fill() } else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.stroke() }
  })
  // plan line
  ctx.fillStyle = 'rgba(230,240,255,0.85)'; fit(ctx, d.sub, W - 220, 42, BODY, 600); ctx.fillText(d.sub, W / 2, 1480)
  // footer
  ctx.fillStyle = 'rgba(247,197,72,0.9)'; ctx.font = `700 34px ${FONT}`; ctx.fillText('by Darshan Chavda', W / 2, 1700)
  ctx.fillStyle = 'rgba(103,232,249,0.8)'; fit(ctx, d.site, W - 220, 30, BODY, 500); ctx.fillText(d.site, W / 2, 1760)
  return c
}

export const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/png'))

/** 'shared' | 'downloaded' | 'cancelled' */
export async function shareOrDownload(c: HTMLCanvasElement, text: string, url: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await toBlob(c)
  if (!blob) return 'cancelled'
  const file = new File([blob], 'd31-workout-done.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text: `${text} ${url}` }); return 'shared' } catch (e) { if ((e as Error)?.name === 'AbortError') return 'cancelled' }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'd31-workout-done.png'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'downloaded'
}
