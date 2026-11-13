import type { CheckIn, Profile, WorkoutSession, LoggedSet } from '../types'

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

/** Local calendar date YYYY-MM-DD (not UTC) */
export function dayKey(d: Date | string = new Date()): string {
  const x = typeof d === 'string' ? new Date(d) : d
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

export function fmtDate(iso: string, lang: string): string {
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'gu' ? 'gu-IN' : 'en-IN'
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

/** Epley estimated 1-rep max */
export const epley = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30))

export function setVolume(s: LoggedSet) {
  return s.done ? s.kg * s.reps : 0
}

/** Current streak: consecutive days (ending today or yesterday) with ≥1 workout */
export function computeStreak(sessions: WorkoutSession[], now = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)))
  let streak = 0
  const d = new Date(now)
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  while (days.has(dayKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** Monday-start week key */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const wd = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - wd)
  return x
}

export function weeklyBuckets(sessions: WorkoutSession[], weeks = 8, now = new Date()) {
  const start = weekStart(now)
  const out = Array.from({ length: weeks }, (_, i) => {
    const ws = new Date(start)
    ws.setDate(ws.getDate() - (weeks - 1 - i) * 7)
    return { start: ws, volume: 0, count: 0 }
  })
  for (const s of sessions) {
    const ws = weekStart(new Date(s.startedAt)).getTime()
    const b = out.find((o) => o.start.getTime() === ws)
    if (b) {
      b.volume += s.volumeKg
      b.count += 1
    }
  }
  return out
}

/** Mifflin-St Jeor BMR × activity, adjusted for goal. Protein in g/kg by goal. */
export function nutritionTargets(p: Profile) {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
  const tdee = bmr * p.activity
  const adj = p.goal === 'fatloss' ? -0.2 : p.goal === 'muscle' ? 0.1 : p.goal === 'strength' ? 0.05 : 0
  const kcal = Math.round((tdee * (1 + adj)) / 10) * 10
  const proteinPerKg = p.goal === 'fatloss' ? 2.2 : p.goal === 'muscle' || p.goal === 'strength' ? 2.0 : 1.6
  const protein = Math.round(p.weightKg * proteinPerKg)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fat, water: Math.round(p.weightKg * 0.035 * 4) }
}

/** Readiness 0–100 from a check-in (scales 1–5; soreness and stress are inverted). */
export function readinessScore(c: Omit<CheckIn, 'score' | 'date'>): number {
  const sleepH = Math.min(1, Math.max(0, (c.sleepH - 4) / 4)) // 4h→0, 8h→1
  const n = (v: number) => (v - 1) / 4
  const score = 0.3 * sleepH + 0.15 * n(c.sleepQ) + 0.2 * (1 - n(c.soreness)) + 0.2 * n(c.energy) + 0.15 * (1 - n(c.stress))
  return Math.round(score * 100)
}

export function readinessBand(score: number): 'hard' | 'moderate' | 'easy' {
  return score >= 70 ? 'hard' : score >= 45 ? 'moderate' : 'easy'
}

export async function compressImage(file: File | Blob, maxSide = 720, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function speak(text: string, lang: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === 'hi' ? 'hi-IN' : lang === 'gu' ? 'gu-IN' : 'en-IN'
  u.rate = 1.05
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.2, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.35)
    if (navigator.vibrate) navigator.vibrate(200)
  } catch {
    /* audio not available */
  }
}
