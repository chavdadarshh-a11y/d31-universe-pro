// Unit checks for pure logic (run: npm test). Uses Node's built-in TypeScript stripping.
import { createHmac } from 'node:crypto'
import { computeRecords, isPR, ladderStatus, summarizeSets, volumeOf } from '../src/lib/training.ts'
import { LADDER_BY_ID } from '../src/data/ladders.ts'
import { computeStreak, epley, nutritionTargets, readinessBand, readinessScore, weeklyBuckets } from '../src/lib/util.ts'

let failed = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - offset); d.setHours(10); return d.toISOString() }
const s = (o: number) => ({ id: String(o), name: 'x', startedAt: day(o), durationSec: 60, volumeKg: 100, exercises: [], source: 'player' as const })
ok(computeStreak([s(0), s(1), s(2), s(4)]) === 3, 'streak counts consecutive days incl. today')
ok(computeStreak([s(1), s(2)]) === 2, 'streak still alive if last workout was yesterday')
ok(computeStreak([s(3)]) === 0, 'streak resets after a gap')
ok(Math.round(epley(100, 5)) === 117, 'Epley 1RM 100kg×5 ≈ 117')
const tg = nutritionTargets({ name: '', goal: 'muscle', level: 'beginner', equipment: ['none'], sex: 'male', age: 25, heightCm: 175, weightKg: 70, activity: 1.55 })
ok(tg.bmr === 1674 && tg.kcal > 2700 && tg.kcal < 3000, `Mifflin-St Jeor BMR 1674, kcal ${tg.kcal}`)
ok(tg.protein === 140, 'protein 2 g/kg for muscle gain')
ok(readinessScore({ sleepH: 8, sleepQ: 5, soreness: 1, energy: 5, stress: 1 }) === 100, 'perfect check-in = 100')
ok(readinessBand(readinessScore({ sleepH: 4, sleepQ: 1, soreness: 5, energy: 1, stress: 5 })) === 'easy', 'bad check-in → recovery day')
ok(weeklyBuckets([s(0), s(1)], 8).length === 8, '8 weekly buckets')

// v3 manual logging: free-form sets, warm-ups never count, ladders read only real logs
type St = { reps: number; kg: number; secs?: number; type?: 'warmup' | 'working' | 'drop' | 'failure'; done: boolean }
const sess = (o: number, exId: string, sets: St[]) => ({ ...s(o), id: `${exId}${o}`, exercises: [{ exId, sets }] })
ok(summarizeSets([{ reps: 8, kg: 20, done: true }, { reps: 8, kg: 20, done: true }, { reps: 8, kg: 20, done: true }, { reps: 8, kg: 20, done: true }], 'reps') === '4×8 @ 20kg', 'summary collapses identical sets (4×8 @ 20kg)')
ok(summarizeSets([{ reps: 15, kg: 0, done: true }, { reps: 11, kg: 0, done: true }, { reps: 7, kg: 0, done: true }, { reps: 5, kg: 0, done: true }, { reps: 3, kg: 0, done: true }], 'reps') === '15, 11, 7, 5 +1', 'summary keeps any number of uneven sets')
ok(summarizeSets([{ reps: 10, kg: 10, type: 'warmup', done: true }, { reps: 5, kg: 40, done: true }], 'reps') === '1×5 @ 40kg', 'summary skips warm-ups')
const warm = [sess(1, 'barbell-row', [{ reps: 10, kg: 100, type: 'warmup', done: true }, { reps: 8, kg: 50, done: true }])]
const recs = computeRecords(warm, () => 'reps')
ok(recs.length === 1 && recs[0].kg === 50, 'warm-up sets are excluded from PRs')
ok(volumeOf(warm[0].exercises[0].sets) === 400, 'volume excludes warm-ups (8×50 = 400)')
ok(isPR('barbell-row', { reps: 8, kg: 55, done: true }, 'reps', warm), 'heavier working set is a PR')
ok(!isPR('barbell-row', { reps: 8, kg: 55, type: 'warmup', done: true }, 'reps', warm), 'heavier warm-up is NOT a PR')
const fl = LADDER_BY_ID['front-lever']
ok(ladderStatus(fl, []).current === 0 && ladderStatus(fl, []).cleared.every((c) => !c), 'empty log → ladder at step 1, nothing cleared (no fake progress)')
const flLog = [sess(2, 'pull-up', [8, 9, 8].map((r) => ({ reps: r, kg: 0, done: true }))), sess(1, 'tuck-front-lever', [12, 10, 9].map((x) => ({ reps: 0, kg: 0, secs: x, done: true })))]
ok(ladderStatus(fl, flLog).current === 1, 'tuck 12/10/9 s does not clear 3×10 s')
flLog[1].exercises[0].sets[2].secs = 10
ok(ladderStatus(fl, flLog).current === 2, '3 holds ≥10 s clear tuck → advanced tuck is next')

// Razorpay signature: same algorithm as supabase/functions/razorpay-verify
const secret = 'test_secret', order = 'order_ABC', pay = 'pay_XYZ'
const sig = createHmac('sha256', secret).update(`${order}|${pay}`).digest('hex')
const sub = globalThis.crypto.subtle
const key = await sub.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
const web = [...new Uint8Array(await sub.sign('HMAC', key, new TextEncoder().encode(`${order}|${pay}`)))].map((b) => b.toString(16).padStart(2, '0')).join('')
ok(web === sig, 'WebCrypto HMAC (edge function) matches Razorpay reference signature')

console.log(failed ? `\n${failed} failed` : '\nAll logic checks passed')
process.exit(failed ? 1 : 0)
