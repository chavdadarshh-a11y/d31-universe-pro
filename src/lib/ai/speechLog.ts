/**
 * Parse a spoken (or typed) set log into an exercise + numbers.
 * Confirm in the UI before writing a set.
 */
import { matchExercises, resolveExercise } from '../exerciseMatch'
import { extractSetFields, digitize, type ExtractedSet } from './speechParse'

export { digitize, extractSetFields }
export type { ExtractedSet }

export type ParsedSet = ExtractedSet & {
  exId?: string
  ok: boolean
}

export function parseSpeechSet(raw: string): ParsedSet {
  const fields = extractSetFields(raw)
  if (fields.error === 'empty') return { ...fields, ok: false }
  const hit = fields.exQuery ? resolveExercise(fields.exQuery) : null
  const loose = !hit && fields.exQuery ? matchExercises(fields.exQuery, 1)[0] : undefined
  const exId = hit?.id ?? (loose && loose.score >= 0.62 ? loose.id : undefined)
  const ok = !!exId && !fields.error
  return {
    ...fields,
    exId,
    ok,
    error: fields.error ?? (exId ? undefined : 'no-exercise'),
  }
}

export type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechLang(app: 'en' | 'hi' | 'gu'): string {
  return app === 'hi' ? 'hi-IN' : app === 'gu' ? 'gu-IN' : 'en-IN'
}
