/**
 * Pull exercise words, weight, reps, time and a note out of a spoken/typed line.
 * No exercise-library lookup here, so this file is safe to unit-test in Node.
 */
const DEV = '०१२३४५६७८९'
const GUJ = '૦૧૨૩૪૫૬૭૮૯'
const DIGIT: Record<string, string> = {}
for (let i = 0; i < 10; i++) {
  DIGIT[DEV[i]!] = String(i)
  DIGIT[GUJ[i]!] = String(i)
}

export function digitize(s: string): string {
  return [...s].map((c) => DIGIT[c] ?? c).join('')
}

export type ExtractedSet = {
  exQuery: string
  kg: number
  unit: 'kg' | 'lb'
  reps: number
  secs?: number
  note?: string
  raw: string
  error?: 'empty' | 'no-exercise' | 'no-numbers'
}

const LB = 2.2046226218
const round1 = (n: number) => Math.round(n * 10) / 10

export function extractSetFields(raw: string): ExtractedSet {
  const empty: ExtractedSet = { exQuery: '', kg: 0, unit: 'kg', reps: 0, raw, error: 'empty' }
  let s = digitize(raw).replace(/\s+/g, ' ').trim()
  if (!s) return empty

  let note: string | undefined
  const parts = s.split(/\s*(?:,+|note\s*:|नोट\s*:|નોંધ\s*:)\s*/i)
  if (parts.length > 1) {
    note = parts.slice(1).join(', ').trim() || undefined
    s = parts[0]!.trim()
  }

  let unit: 'kg' | 'lb' = 'kg'
  let kg = 0
  const w = s.match(/(\d+(?:\.\d+)?)\s*(kgs?|kilos?|kilograms?|किलो|કિલો|lbs?|pounds?|पाउंड|પાઉન્ડ)(?=[\s,.]|$)/i)
  if (w) {
    const n = parseFloat(w[1]!)
    const u = w[2]!.toLowerCase()
    if (/^(lb|pound|पाउंड|પાઉન્ડ)/.test(u) || u === 'lbs') {
      unit = 'lb'
      kg = n / LB
    } else kg = n
    s = s.replace(w[0], ' ')
  }

  let secs: number | undefined
  const t = s.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|सेकंड|सेकेंड|સેકન્ડ)(?=[\s,.]|$)/i)
  if (t) {
    secs = Math.round(parseFloat(t[1]!))
    s = s.replace(t[0], ' ')
  }

  let reps = 0
  const rNamed = s.match(/(\d+)\s*(reps?|repetitions?|रेप्स?|રેપ્સ?|વાર|बार)(?=[\s,.]|$)/i)
  const rTimes = s.match(/[x×]\s*(\d+)\b/i)
  if (rNamed) {
    reps = parseInt(rNamed[1]!, 10)
    s = s.replace(rNamed[0], ' ')
  } else if (rTimes) {
    reps = parseInt(rTimes[1]!, 10)
    s = s.replace(rTimes[0], ' ')
  } else {
    const nums = [...s.matchAll(/\d+/g)]
    if (nums.length) {
      const pick = kg > 0 || secs != null ? nums[nums.length - 1]! : nums[0]!
      reps = parseInt(pick[0], 10)
      s = `${s.slice(0, pick.index)}${s.slice(pick.index! + pick[0].length)}`
    }
  }

  const exQuery = s
    .replace(/\b(of|and|the|a|an|set|sets|done|please|log|kiya|kiye|kar|tha|thi|thee|hain|hai|હતું|કર્યું)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const hasWork = reps > 0 || secs != null || kg > 0
  if (!exQuery) return { exQuery, kg: round1(kg), unit, reps, secs, note, raw, error: 'no-exercise' }
  if (!hasWork) return { exQuery, kg: round1(kg), unit, reps, secs, note, raw, error: 'no-numbers' }
  return { exQuery, kg: round1(kg), unit, reps, secs, note, raw }
}
