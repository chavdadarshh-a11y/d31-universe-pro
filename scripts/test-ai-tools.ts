// Unit checks for on-device AI helpers (run: npm test).
import { findDeepestSquat, findFormBreaks, fmtStamp, parseMomentQuery, runMomentQuery, segmentReps, type FrameMetrics } from '../src/lib/ai/momentSearch.ts'
import { digitize, extractSetFields } from '../src/lib/ai/speechParse.ts'
import { buildAnalystPrompt, parseAnalystReply } from '../src/lib/ai/analystPrompt.ts'
import { scoreMediaQuery } from '../src/lib/ai/mediaQuery.ts'

let failed = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }

ok(parseMomentQuery('show deepest squat') === 'deepest-squat', 'en: deepest squat')
ok(parseMomentQuery('सबसे गहरी स्क्वाट दिखाओ') === 'deepest-squat', 'hi: deepest squat')
ok(parseMomentQuery('સૌથી ઊંડી સ્ક્વોટ બતાવો') === 'deepest-squat', 'gu: deepest squat')
ok(parseMomentQuery('where did form break?') === 'form-break', 'en: form break')
ok(parseMomentQuery('form kahan bigdi') === 'form-break', 'hinglish: form break')
ok(parseMomentQuery('फॉर्म कहाँ टूटी') === 'form-break', 'hi: form break')
ok(parseMomentQuery('ફોર્મ ક્યાં તૂટી') === 'form-break', 'gu: form break')
ok(parseMomentQuery('show deepest push-up') === 'deepest-pushup', 'deepest push-up')
ok(parseMomentQuery('lockout') === 'lockout', 'lockout')
ok(parseMomentQuery('count reps') === 'reps', 'reps')
ok(parseMomentQuery('') === null, 'empty query is null')

// A two-rep squat: bottoms at 1.0s (knee 70) and 3.0s (knee 90, valgus + lean)
const frames: FrameMetrics[] = [
  { t: 0.0, ok: true, view: 'side', knee: 170, hip: 170, trunkLean: 10 },
  { t: 0.5, ok: true, view: 'side', knee: 110, hip: 120, trunkLean: 20 },
  { t: 1.0, ok: true, view: 'side', knee: 70, hip: 80, trunkLean: 25 },
  { t: 1.5, ok: true, view: 'side', knee: 165, hip: 165, trunkLean: 12 },
  { t: 2.0, ok: true, view: 'front', knee: 165, hip: 165, trunkLean: 15, kneeRatio: 1.0 },
  { t: 2.5, ok: true, view: 'front', knee: 100, hip: 110, trunkLean: 40, kneeRatio: 0.7 },
  { t: 3.0, ok: true, view: 'front', knee: 90, hip: 100, trunkLean: 60, kneeRatio: 0.65 },
  { t: 3.5, ok: true, view: 'front', knee: 165, hip: 165, trunkLean: 20, kneeRatio: 1.0 },
]
ok(segmentReps(frames, 'knee').length === 2, 'segments 2 squat reps')
const deep = findDeepestSquat(frames)
ok(!!deep && Math.abs(deep.t - 1.0) < 0.01 && deep.value === 70, `deepest squat at 1.0s knee 70 (got t=${deep?.t} v=${deep?.value})`)
const br = findFormBreaks(frames)
ok(!!br && (br.reason === 'valgus' || br.reason === 'trunk' || br.reason === 'shallow-rep'), `form break found (${br?.reason} @ ${br?.t})`)
ok(!!br && br.t >= 2.5, 'form break is on the second (worse) rep')
ok(runMomentQuery('show deepest squat', frames)?.t === 1, 'query runs deepest squat')
ok(fmtStamp(65.2) === '1:05.2', `fmtStamp 65.2 → ${fmtStamp(65.2)}`)

ok(digitize('१२०') === '120', 'devanagari digits')
ok(digitize('૧૨૦') === '120', 'gujarati digits')
const squat = extractSetFields('Squat 120 kg 5 reps, last rep slow')
ok(!squat.error && /squat/i.test(squat.exQuery), `squat query=${squat.exQuery}`)
ok(squat.kg === 120 && squat.reps === 5 && squat.unit === 'kg', `120kg x5 (got ${squat.kg}x${squat.reps})`)
ok(squat.note && /slow/i.test(squat.note), `note kept (${squat.note})`)
const lbs = extractSetFields('bench press 185 lbs 3 reps')
ok(!lbs.error && lbs.unit === 'lb' && Math.abs(lbs.kg - 185 / 2.2046226218) < 0.2 && lbs.reps === 3, `lbs converted to kg (${lbs.kg})`)
ok(/bench/i.test(lbs.exQuery), `bench query=${lbs.exQuery}`)
const pulls = extractSetFields('pull ups 12')
ok(!pulls.error && pulls.reps === 12 && /pull/i.test(pulls.exQuery), `pull ups 12 → ${pulls.exQuery} x${pulls.reps}`)
const hiSet = extractSetFields('स्क्वाट ८० किलो ८ रेप्स')
ok(!hiSet.error && hiSet.kg === 80 && hiSet.reps === 8, `hindi squat 80kg x8 (got ${hiSet.kg}x${hiSet.reps} err=${hiSet.error} q=${hiSet.exQuery})`)
ok(extractSetFields('').error === 'empty', 'empty speech')
ok(extractSetFields('hello there').error === 'no-numbers', 'words with no numbers')

const prompt = buildAnalystPrompt({
  lang: 'hi',
  angles: [{ label: 'Knee', value: '82°' }, { label: 'Trunk lean', value: '28°' }],
  exercise: 'Back squat',
  view: 'side',
})
ok(prompt.length <= 1000, `analyst prompt fits 1000-char cap (${prompt.length})`)
ok(/Hindi/.test(prompt) && /82°/.test(prompt) && /EXERCISE:/.test(prompt), 'prompt has language, angles, headers')
const parsed = parseAnalystReply(`EXERCISE: Back squat
VISIBLE: Side view, bar on the back.
GOOD: Knees track over toes.
CHECK: Chest drops slightly at the bottom.
CORRECTION: Brace and keep the chest tall.
NEXT CUE: Big breath, ribs down, sit between the heels.
CONFIDENCE: medium`)
ok(parsed.parsed && parsed.sections.EXERCISE === 'Back squat' && parsed.sections['NEXT CUE']?.includes('heels') && parsed.sections.CONFIDENCE === 'medium', 'analyst reply parsed')

const hsTags = ['Handstand line', 'skills', 'handstand', 'hs', 'हैंडस्टैंड']
ok(scoreMediaQuery('handstand line', hsTags) > scoreMediaQuery('handstand line', ['bench press', 'strength']), 'handstand line ranks the handstand photo first')
ok(scoreMediaQuery('back double biceps', ['Back Double Biceps', 'physique', 'rdb', 'rear double biceps']) > 0, 'back double biceps matches tags')
ok(scoreMediaQuery('zzzz-not-a-photo-xyz', ['Handstand line', 'back squat']) === 0, 'unknown query scores 0')

console.log(failed ? `\n${failed} failed` : '\nAll AI tool checks passed')
process.exit(failed ? 1 : 0)
