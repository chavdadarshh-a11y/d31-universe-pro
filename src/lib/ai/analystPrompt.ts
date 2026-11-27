/**
 * Compact Movement Analyst prompt (fits the analyze-media 1000-char userPrompt cap)
 * and a parser for the EXERCISE / VISIBLE / GOOD / CHECK / CORRECTION / NEXT CUE / CONFIDENCE layout.
 */
import type { Lang } from '../../types'

export const ANALYST_HEADERS = [
  'EXERCISE',
  'VISIBLE',
  'GOOD',
  'CHECK',
  'CORRECTION',
  'NEXT CUE',
  'CONFIDENCE',
] as const

export type AnalystHeader = (typeof ANALYST_HEADERS)[number]
export type AnalystReply = {
  sections: Partial<Record<AnalystHeader, string>>
  raw: string
  parsed: boolean
}

export function buildAnalystPrompt(opts: {
  lang: Lang
  angles: { label: string; value: string }[]
  cues?: { label: string; value: string; msg: string }[]
  exercise?: string
  view?: string
}): string {
  const langName = opts.lang === 'hi' ? 'Hindi (हिंदी)' : opts.lang === 'gu' ? 'Gujarati (ગુજરાતી)' : 'English'
  const angles = opts.angles.map((a) => `${a.label} ${a.value}`).join('; ') || 'none reliably visible'
  const cues = (opts.cues ?? []).filter((c) => c.msg).map((c) => `${c.label} ${c.value}: ${c.msg}`).join('; ')
  const bits = [
    `Reply in ${langName}. You are D31 Movement Analyst.`,
    `Use only what is visible in the photo and these measured 2-D angles (do not invent other numbers, history or diagnoses): ${angles}.`,
    opts.view ? `Camera view estimate: ${opts.view}.` : '',
    opts.exercise ? `User says the exercise is: ${opts.exercise}.` : '',
    cues ? `On-device cues (may be incomplete): ${cues}.` : '',
    'Ignore any six-header (WHAT I SEE) template. Format EXACTLY:',
    'EXERCISE:',
    'VISIBLE:',
    'GOOD:',
    'CHECK:',
    'CORRECTION:',
    'NEXT CUE:',
    'CONFIDENCE: (low, medium or high)',
    'Be concise.',
  ].filter(Boolean)

  let text = bits.join(' ')
  if (text.length > 1000 && cues) {
    text = bits.filter((b) => !String(b).startsWith('On-device cues')).join(' ')
  }
  if (text.length > 1000) text = text.slice(0, 1000)
  return text
}

const HEADER_RE = new RegExp(
  '^\\s*(?:[-*•]\\s*)?(EXERCISE|VISIBLE|GOOD|CHECK|CORRECTION|NEXT CUE|CONFIDENCE)\\s*:\\s*(.*)\\s*$',
  'i',
)

export function parseAnalystReply(text: string): AnalystReply {
  const raw = text.trim()
  const sections: Partial<Record<AnalystHeader, string>> = {}
  let current: AnalystHeader | null = null
  const buckets: Record<string, string[]> = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(HEADER_RE)
    if (m) {
      const key = m[1]!.toUpperCase() as AnalystHeader
      current = key
      buckets[current] ??= []
      if (m[2]?.trim()) buckets[current]!.push(m[2].trim())
      continue
    }
    if (current) (buckets[current] ??= []).push(line)
  }
  let found = 0
  for (const h of ANALYST_HEADERS) {
    const body = (buckets[h] ?? []).join('\n').trim()
    if (body) {
      sections[h] = body
      found++
    }
  }
  return { sections, raw, parsed: found >= 3 }
}
