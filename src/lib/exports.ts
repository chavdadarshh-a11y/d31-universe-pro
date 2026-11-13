/**
 * Platinum downloads: branded program PDF, workout-history PDF + CSV, offline clips.
 * jsPDF is loaded only when someone downloads (keeps the app bundle small).
 * PDFs use English exercise names — the built-in PDF font can't draw Hindi/Gujarati glyphs.
 */
import type { Program, WorkoutSession } from '../types'
import { exName, exOf } from '../data/exercises'
import { APP_VERSION } from './env'
import { wTxt, wUnit, toW } from './units'
import { download, fmtClock } from './util'

type Doc = import('jspdf').jsPDF
type RGB = [number, number, number]
const INK: RGB = [16, 20, 30]
const MUTED: RGB = [96, 104, 120]
const CYAN: RGB = [8, 145, 178]
const GOLD: RGB = [196, 140, 20]

let logo: string | null = null
async function logoData(): Promise<string | null> {
  if (logo) return logo
  try {
    const b = await (await fetch(`${import.meta.env.BASE_URL}icons/icon-192.png`)).blob()
    logo = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b) })
    return logo
  } catch { return null }
}
const ascii = (s: string) => s.replace(/[–—]/g, '-').replace(/[→⇒]/g, ' to ').replace(/[·•]/g, '|').replace(/×/g, 'x').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()

async function newDoc(title: string, sub: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(7, 8, 11); doc.rect(0, 0, W, 34, 'F')
  doc.setFillColor(...CYAN); doc.rect(0, 34, W * 0.62, 1.2, 'F')
  doc.setFillColor(...GOLD); doc.rect(W * 0.62, 34, W * 0.38, 1.2, 'F')
  const l = await logoData()
  if (l) doc.addImage(l, 'PNG', 12, 7, 20, 20)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
  doc.text('D31.UNIVERSE', l ? 37 : 12, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(165, 243, 252)
  doc.text('by Darshan Chavda', l ? 37 : 12, 22)
  doc.setTextColor(200, 205, 215); doc.text(new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' }), W - 12, 16, { align: 'right' })
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text(ascii(title), 12, 50)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTED)
  doc.text(ascii(sub), 12, 57)
  return { doc, W }
}

function footer(doc: Doc, note: string) {
  const n = doc.getNumberOfPages()
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(220, 224, 232); doc.line(12, H - 14, W - 12, H - 14)
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal')
    doc.text(ascii(note), 12, H - 9)
    doc.text(`D31.UNIVERSE v${APP_VERSION}  |  ${i}/${n}`, W - 12, H - 9, { align: 'right' })
  }
}

function ensure(doc: Doc, y: number, need: number) {
  if (y + need > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); return 18 }
  return y
}

function wrap(doc: Doc, text: string, x: number, y: number, w: number, size = 10, color: RGB = INK, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color)
  const lines = doc.splitTextToSize(ascii(text), w) as string[]
  doc.text(lines, x, y)
  return y + lines.length * size * 0.42 + 1.5
}

const dose = (it: { sets: number; reps?: number; secs?: number }) => `${it.sets} x ${it.secs && !it.reps ? `${it.secs}s` : it.reps ?? '-'}`

/** Branded, print-readable program plan. */
export async function programPdf(p: Program): Promise<Blob> {
  const { doc, W } = await newDoc(p.name, `${p.weeks} weeks  |  ${p.daysPerWeek} days / week  |  Level ${p.level}  |  ${p.plan.toUpperCase()}`)
  let y = wrap(doc, p.description, 12, 66, W - 24, 10.5, INK) + 3
  for (const [di, d] of p.days.entries()) {
    y = ensure(doc, y, 24)
    doc.setFillColor(238, 246, 250); doc.roundedRect(12, y - 5, W - 24, 9, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...CYAN)
    doc.text(`DAY ${di + 1}`, 15, y + 1)
    doc.setTextColor(...INK); doc.text(ascii(d.name), 34, y + 1)
    y += 9
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
    doc.text('EXERCISE', 15, y); doc.text('SETS x REPS', W - 78, y); doc.text('REST', W - 48, y); doc.text('DONE', W - 26, y)
    y += 5
    for (const it of d.items) {
      y = ensure(doc, y, 10)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK)
      doc.text(ascii(exName(exOf(it.exId), 'en')), 15, y)
      doc.text(dose(it), W - 78, y)
      doc.text(`${it.rest}s`, W - 48, y)
      doc.setDrawColor(170, 176, 190); doc.rect(W - 24, y - 3.6, 4.5, 4.5)
      y += 4.6
      const extra = [it.target ? `Target ${it.target}` : '', it.note].filter(Boolean).join('  |  ')
      if (extra) y = wrap(doc, extra, 15, y, W - 100, 8.5, MUTED)
      doc.setDrawColor(235, 238, 243); doc.line(15, y - 1.5, W - 12, y - 1.5)
      y += 3
    }
    y += 4
  }
  footer(doc, 'Every number is a suggestion. Adjust sets, reps and weight to how you feel. (c) Darshan Chavda / D31')
  return doc.output('blob')
}

/** Workout history as a PDF log. */
export async function historyPdf(sessions: WorkoutSession[], athlete: string): Promise<Blob> {
  const done = sessions.filter((s) => s.exercises.length)
  const { doc, W } = await newDoc('Workout history', `${athlete ? `${ascii(athlete)}  |  ` : ''}${done.length} ${done.length === 1 ? 'workout' : 'workouts'}  |  weights in ${wUnit()}`)
  let y = 68
  for (const s of done) {
    const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0)
    y = ensure(doc, y, 20)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...INK)
    doc.text(ascii(s.name) || 'Workout', 12, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text(`${new Date(s.startedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}  |  ${fmtClock(s.durationSec)}  |  ${sets} ${sets === 1 ? 'set' : 'sets'}${s.volumeKg ? `  |  ${wTxt(s.volumeKg, true)}` : ''}`, W - 12, y, { align: 'right' })
    y += 6
    for (const e of s.exercises) {
      y = ensure(doc, y, 6)
      const line = e.sets.map((st) => (st.secs && !st.reps ? `${st.secs}s` : st.kg ? `${toW(st.kg)}x${st.reps}` : `${st.reps}`)).join('   ')
      doc.setFontSize(9.5); doc.setTextColor(...INK); doc.text(ascii(exName(exOf(e.exId), 'en')), 16, y)
      y = wrap(doc, line, 80, y, W - 92, 9.5, MUTED) + 0.5
    }
    doc.setDrawColor(225, 229, 236); doc.line(12, y, W - 12, y)
    y += 6
  }
  if (!done.length) wrap(doc, 'No workouts logged yet.', 12, y, W - 24)
  footer(doc, 'Your own training log, exported from D31.UNIVERSE.')
  return doc.output('blob')
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export function historyCsv(sessions: WorkoutSession[]): string {
  const u = wUnit()
  const rows = [['date', 'workout', 'exercise', 'set', 'type', 'reps', `weight_${u}`, 'seconds', 'rpe', 'note']]
  for (const s of sessions)
    for (const e of s.exercises)
      e.sets.forEach((st, i) => rows.push([s.startedAt, s.name, exName(exOf(e.exId), 'en'), String(i + 1), st.type ?? 'working', String(st.reps ?? ''), st.kg ? String(toW(st.kg)) : '', st.secs ? String(st.secs) : '', st.rpe ? String(st.rpe) : '', st.note ?? '']))
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

export function saveBlob(name: string, blob: Blob) {
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 4000)
}
export const slug = (s: string) => ascii(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'd31'
export const saveCsv = (name: string, text: string) => download(name, text, 'text/csv;charset=utf-8')

