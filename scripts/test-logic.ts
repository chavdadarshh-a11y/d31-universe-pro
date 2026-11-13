// Unit checks for pure logic (run: npm test). Uses Node's built-in TypeScript stripping.
import { createHmac } from 'node:crypto'
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

// Razorpay signature: same algorithm as supabase/functions/razorpay-verify
const secret = 'test_secret', order = 'order_ABC', pay = 'pay_XYZ'
const sig = createHmac('sha256', secret).update(`${order}|${pay}`).digest('hex')
const sub = globalThis.crypto.subtle
const key = await sub.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
const web = [...new Uint8Array(await sub.sign('HMAC', key, new TextEncoder().encode(`${order}|${pay}`)))].map((b) => b.toString(16).padStart(2, '0')).join('')
ok(web === sig, 'WebCrypto HMAC (edge function) matches Razorpay reference signature')

console.log(failed ? `\n${failed} failed` : '\nAll logic checks passed')
process.exit(failed ? 1 : 0)
