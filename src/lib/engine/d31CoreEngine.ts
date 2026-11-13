/**
 * D31 Core Engine — prompt + response headers (client copy).
 * Keep in sync with supabase/functions/_shared/d31CoreEngine.ts
 * Prompt text below is the user's verbatim instruction (do not reword).
 */

export const D31_ANALYSIS_HEADERS = [
  'WHAT I SEE',
  'QUICK VERDICT',
  "WHAT'S GOOD",
  'FIX THIS',
  'TECHNIQUE',
  'NEXT MOVE',
] as const

export type D31AnalysisHeader = (typeof D31_ANALYSIS_HEADERS)[number]

/** Verbatim user prompt template. Interpolate userPrompt at call sites. */
export const D31_CORE_ENGINE_PROMPT = `You are the D31 Core Engine, built by Darshan Chavda. Analyze this user upload strictly according to D31 Sovereign Standards. No validation, no sugarcoating—give direct, sharp, professional biomechanical feedback. Format your response precisely under these headers:
        - WHAT I SEE
        - QUICK VERDICT
        - WHAT'S GOOD
        - FIX THIS
        - TECHNIQUE
        - NEXT MOVE
        
        User Query: `

export type ParsedAnalysis = {
  sections: Partial<Record<D31AnalysisHeader, string>>
  raw: string
  parsed: boolean
}

/** Parse Gemini text into the six HUD sections. Falls back to raw if headers missing. */
export function parseD31Analysis(text: string): ParsedAnalysis {
  const raw = text.trim()
  const sections: Partial<Record<D31AnalysisHeader, string>> = {}
  const headerPattern = new RegExp(
    `^\\s*(?:[-*•]\\s*)?(${D31_ANALYSIS_HEADERS.map((h) =>
      h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ).join('|')})\\s*:?\\s*$`,
    'im',
  )

  // Split by lines looking for exact header lines
  const lines = raw.split(/\r?\n/)
  let current: D31AnalysisHeader | null = null
  const buckets: Record<string, string[]> = {}

  for (const line of lines) {
    const match = line.match(headerPattern)
    if (match) {
      current = match[1] as D31AnalysisHeader
      if (!buckets[current]) buckets[current] = []
      continue
    }
    if (current) buckets[current]!.push(line)
  }

  let found = 0
  for (const h of D31_ANALYSIS_HEADERS) {
    const body = (buckets[h] ?? []).join('\n').trim()
    if (body) {
      sections[h] = body
      found++
    }
  }

  return {
    sections,
    raw,
    parsed: found >= 3, // need at least half the headers to consider structured
  }
}

/** Offline SAMPLE response under the six headers (clearly labelled). */
export function sampleD31Analysis(userPrompt: string): string {
  return [
    'WHAT I SEE',
    `[SAMPLE — offline mock] Upload reviewed against D31 Sovereign Standards. Query: "${userPrompt || 'form check'}".`,
    '',
    'QUICK VERDICT',
    'Chain integrity incomplete under fatigue — proximal brace leaks before distal ROM.',
    '',
    "WHAT'S GOOD",
    'Intentional end-range chase. Camera angle usable for sagittal audit.',
    '',
    'FIX THIS',
    'Stop lumbar substitute for hip extension. Soften the chase; own the pelvis first.',
    '',
    'TECHNIQUE',
    'Cue posterior tilt + rib stack before deepening. Slow eccentric into honest end-range.',
    '',
    'NEXT MOVE',
    '3×20s isometric holds at current honest depth, film frontal + sagittal, re-upload.',
  ].join('\n')
}
