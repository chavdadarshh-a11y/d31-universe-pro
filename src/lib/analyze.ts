import { supabase } from './supabase'
import { isLive } from './env'
import { D31_ANALYSIS_HEADERS, parseD31Analysis, type ParsedAnalysis } from './engine/d31CoreEngine'
import type { Exercise } from '../types'

const INLINE_MAX = 20 * 1024 * 1024

export async function fileToBase64(file: File): Promise<string> {
  if (file.size > INLINE_MAX) throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB — max 20 MB. Trim or compress the clip.`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** DEMO text in the six D31 headers, written in plain language so it reads like the real thing. */
export function demoAnalysis(prompt: string, ex?: Exercise): string {
  const name = ex?.name ?? 'your movement'
  const cue = ex?.cues[0] ?? 'Brace before every rep'
  const mistake = ex?.mistakes[0] ?? 'Losing position at the hardest point'
  return [
    'WHAT I SEE',
    `DEMO SAMPLE — ${name}. Side view, full body visible. Question: "${prompt || 'form check'}".`,
    'QUICK VERDICT',
    'Solid base. One fault shows up at the bottom of the rep — fix it before adding load.',
    "WHAT'S GOOD",
    'Stable foot position, controlled tempo and a neutral head.',
    'FIX THIS',
    `${mistake}. Film again after 2 sessions of the cue below.`,
    'TECHNIQUE',
    `${cue}. Slow the lowering to 3 seconds and pause 1 second at the bottom.`,
    'NEXT MOVE',
    '3 sets of 8 at a lighter load with the pause, then re-upload from the same angle.',
  ].join('\n')
}

export type AnalysisResult = ParsedAnalysis & { demo: boolean; remaining?: number }

export async function runAnalysis(opts: { files: File[]; prompt: string; exercise?: Exercise }): Promise<AnalysisResult> {
  const { files, prompt, exercise } = opts
  if (!isLive || !supabase) {
    await new Promise((r) => setTimeout(r, 1400))
    return { ...parseD31Analysis(demoAnalysis(prompt, exercise)), demo: true }
  }
  const media = await Promise.all(files.map(async (f) => ({ mediaBase64: await fileToBase64(f), mimeType: f.type || 'image/jpeg' })))
  const { data, error } = await supabase.functions.invoke('analyze-media', {
    body: {
      media,
      userPrompt: prompt || 'form check',
      exerciseId: exercise?.id ?? null,
      postContent: exercise
        ? { title: exercise.name, core_skill: exercise.name, layer: exercise.layer, summary: exercise.summary, technique: exercise.steps.join(' '), coaching: exercise.cues.join('; ') }
        : undefined,
    },
  })
  if (error) {
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') msg = ((await ctx.json()) as { error?: string }).error ?? msg
    } catch {
      /* keep message */
    }
    throw new Error(msg)
  }
  const d = data as { analysis?: string; error?: string; remaining?: number }
  if (d.error) throw new Error(d.error)
  if (!d.analysis) throw new Error('Empty analysis')
  return { ...parseD31Analysis(d.analysis), demo: false, remaining: d.remaining }
}

export const HEADER_KEYS = {
  'WHAT I SEE': 'h_WHAT_I_SEE',
  'QUICK VERDICT': 'h_QUICK_VERDICT',
  "WHAT'S GOOD": 'h_WHATS_GOOD',
  'FIX THIS': 'h_FIX_THIS',
  TECHNIQUE: 'h_TECHNIQUE',
  'NEXT MOVE': 'h_NEXT_MOVE',
} as const satisfies Record<(typeof D31_ANALYSIS_HEADERS)[number], string>

export { D31_ANALYSIS_HEADERS }
