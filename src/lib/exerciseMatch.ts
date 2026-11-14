/**
 * Typed exercise name → exercise id. The typed name ALWAYS wins over auto-detect.
 * Robust to spacing ("latpulldown"), typos ("let pull down"), Hinglish, Hindi/Gujarati script,
 * and grip/variant words ("wide grip", "close grip", "reverse grip", "v-bar") which become a variant.
 */
import EXJSON from '../data/analysis/exercises.json'
import { ANALYSIS_EXERCISES, type AnalysisExercise } from './formCheck'

export type Grip = 'wide' | 'close' | 'reverse' | 'neutral'
export type Match = { id: string; score: number; grip?: Grip }

const ALIASES = (EXJSON as unknown as { aliases: Record<string, string[] | string> }).aliases

const GRIP_WORDS: [RegExp, Grip][] = [
  [/\b(wide|wider|broad|chaudi|chauda|चौड़ी|चौड़ा|વાઇડ|પહોળી)\b/, 'wide'],
  [/\b(close|closed|narrow|tight|v\s?bar|v-bar|vbar|पास|नज़दीक|ક્લોઝ)\b/, 'close'],
  [/\b(reverse|reversed|underhand|under hand|supinated|ulta|ulti|उल्टा|उल्टी|રિવર્સ)\b/, 'reverse'],
  [/\b(neutral|parallel|hammer grip|mag grip)\b/, 'neutral'],
]
// filler words that never decide the exercise
const FILLER = /\b(grip|grips|machine|cable|seated|sitting|standing|exercise|workout|karna|karte|kar|hai|ka|ki|ke|wala|wali|my|form|check|the|with|on|se|me|mein)\b/g

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFC').replace(/[_\-.,/()+&!?'"’]/g, ' ').replace(/\s+/g, ' ').trim()
const compact = (s: string) => s.replace(/\s+/g, '')

function lev(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m || !n) return m || n
  let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = new Array(n + 1)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}
const sim = (a: string, b: string) => (a && b ? 1 - lev(a, b) / Math.max(a.length, b.length) : 0)

type Cand = { id: string; text: string; c: string; tokens: string[] }
let CANDS: Cand[] | null = null
function cands(): Cand[] {
  if (CANDS) return CANDS
  const out: Cand[] = []
  const add = (id: string, t: string) => { const n = norm(t); if (n) out.push({ id, text: n, c: compact(n), tokens: n.split(' ') }) }
  for (const e of ANALYSIS_EXERCISES) {
    add(e.id, e.name); add(e.id, e.nameHi); add(e.id, e.nameGu); add(e.id, e.id.replace(/-/g, ' '))
    const al = ALIASES[e.id]
    if (Array.isArray(al)) al.forEach((a) => add(e.id, a))
  }
  CANDS = out
  return out
}

/** split the query into the exercise words and a grip modifier */
export function parseQuery(q: string): { base: string; full: string; grip?: Grip } {
  let s = ' ' + norm(q) + ' '
  let grip: Grip | undefined
  for (const [re, g] of GRIP_WORDS) if (re.test(s)) { grip = grip ?? g; s = s.replace(re, ' ') }
  const full = s.replace(/\bgrips?\b/g, ' ').replace(/\s+/g, ' ').trim()
  s = s.replace(FILLER, ' ').replace(/\s+/g, ' ').trim()
  return { base: s, full, grip }
}

function scoreCand(qn: string, qc: string, qt: string[], c: Cand): number {
  if (qc === c.c) return 1
  // whole-string similarity, spaces ignored ("latpulldown", "let pull down")
  let best = sim(qc, c.c)
  // every query word must match some candidate word (typo tolerant)
  if (qt.length) {
    const per = qt.map((w) => Math.max(...c.tokens.map((t) => (t.startsWith(w) && w.length >= 3 ? 0.97 : sim(w, t)))))
    const cover = c.tokens.length ? qt.length / Math.max(qt.length, c.tokens.length) : 0
    const tok = (per.reduce((a, b) => a + b, 0) / per.length) * (0.85 + 0.15 * cover)
    if (Math.min(...per) >= 0.6) best = Math.max(best, tok)
  }
  // candidate fully contained in the query ("barbell back squat form" → back squat)
  if (c.c.length >= 5 && qc.includes(c.c)) best = Math.max(best, 0.9 + 0.05 * Math.min(1, c.c.length / qc.length))
  void qn
  return best
}

/** ranked matches for the suggestion list */
export function matchExercises(q: string, limit = 8): Match[] {
  const { base, full, grip } = parseQuery(q)
  if (!base) return []
  const best = new Map<string, number>()
  // score both the full words ("seated row") and the core words ("lat pulldown" from "lat pulldown machine")
  for (const v of [...new Set([full, base])]) {
    const qc = compact(v), qt = v.split(' ').filter(Boolean)
    for (const c of cands()) {
      const s = scoreCand(v, qc, qt, c)
      if (s > (best.get(c.id) ?? 0)) best.set(c.id, s)
    }
  }
  return [...best.entries()].filter(([, s]) => s >= 0.55).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([id, score]) => ({ id, score, grip }))
}

/** the single exercise a typed name means, or null when it is not clear enough */
export function resolveExercise(q: string): Match | null {
  const m = matchExercises(q, 2)
  if (!m.length || m[0].score < 0.74) return null
  // too close to call between two different exercises → let the user pick
  if (m[1] && m[0].score - m[1].score < 0.02 && m[0].score < 0.95) return null
  return m[0]
}

export const exerciseById = (id: string): AnalysisExercise | undefined => ANALYSIS_EXERCISES.find((e) => e.id === id)

/** which of the candidate exercises a free text (e.g. the AI vision answer) names — only when exactly one */
export function mentionedExercise(text: string, ids: string[]): string | null {
  const t = compact(norm(text))
  if (!t) return null
  const hits = ids.filter((id) => cands().some((c) => c.id === id && c.c.length >= 5 && t.includes(c.c)))
  return hits.length === 1 ? hits[0] : null
}
