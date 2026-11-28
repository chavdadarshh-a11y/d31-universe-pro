// Unit tests: unit conversion round-trips, body-value repair, and the one numeric post order (run: npm test).
import { clampHeightCm, clampWeightKg, kgToLb, lbToKg, cmToIn, inToCm, repairBody, HEIGHT_CM, WEIGHT_KG, HEIGHT_IN, WEIGHT_LB } from '../src/lib/unitMath.ts'
import { sortPosts, neighbours } from '../src/lib/postOrder.ts'

let failed = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }
const r1 = (n: number) => Math.round(n * 10) / 10

// --- weight: lb input → stored kg → lb display never drifts
let drift = 0
const bad: number[] = []
for (let lb = WEIGHT_LB.min; lb <= WEIGHT_LB.max; lb++) { const kg = clampWeightKg(lbToKg(lb)); if (r1(kgToLb(kg)) !== lb) { drift++; bad.push(lb) } }
if (bad.length) console.log('  lb drift at', bad.slice(0, 10))
ok(drift === 0, 'every whole lb 67–551 round-trips exactly (no drift)')
drift = 0
for (let kg10 = 300; kg10 <= 2500; kg10 += 5) { const kg = kg10 / 10; if (clampWeightKg(kg) !== kg) drift++ }
ok(drift === 0, 'every 0.5 kg 30–250 is stored as typed')
// repeated toggling kg↔lb 20× does not change the stored value (conversion only for display)
let kg = 104
for (let i = 0; i < 20; i++) kg = clampWeightKg(lbToKg(r1(kgToLb(kg))))
ok(r1(kg) === 104 && r1(kgToLb(kg)) === 229.3, '20 kg↔lb re-entries still show 104 kg / 229.3 lb (never 230)')
ok(r1(kgToLb(104)) === 229.3 && clampWeightKg(104) === 104, '104 kg shows 229.3 lb only in lb mode; kg stays 104')
// --- height: inches input round-trips at 0.5 in
let hd = 0
const badh: number[] = []
for (let i2 = HEIGHT_IN.min * 2; i2 <= HEIGHT_IN.max * 2; i2++) { const inch = i2 / 2; const cm = clampHeightCm(inToCm(inch)); if (r1(cmToIn(cm)) !== inch) { hd++; badh.push(inch) } }
if (badh.length) console.log('  in drift at', badh.slice(0, 10))
ok(hd === 0, 'every 0.5 in 39.5–98 round-trips (no drift)')
ok(clampHeightCm(99) === HEIGHT_CM.min && clampHeightCm(260) === HEIGHT_CM.max && clampWeightKg(10) === WEIGHT_KG.min && clampWeightKg(400) === WEIGHT_KG.max, 'ranges: height 100–250 cm, weight 30–250 kg')
// --- repair of corrupted saved values (old per-keystroke clamp stuck them at 13/90, 120/230, 30/250)
const d = { age: 25, heightCm: 172, weightKg: 70 }
ok(JSON.stringify(repairBody({ age: 90, heightCm: 120, weightKg: 30 }, d)) === JSON.stringify(d), 'values stuck at the old edges reset to defaults')
ok(JSON.stringify(repairBody({ age: 13, heightCm: 230, weightKg: 250 }, d)) === JSON.stringify(d), 'other old edges reset too')
ok(repairBody({ age: 31, heightCm: 178, weightKg: 82.5 }, d).weightKg === 82.5, 'real values are kept')
ok(repairBody({ age: '28' as unknown as number, heightCm: NaN, weightKg: 1040 }, d).weightKg === 70 && repairBody({ age: '28', heightCm: NaN, weightKg: 1 }, d).heightCm === 172, 'NaN / out-of-range repaired')

ok(repairBody({ age: 30, heightCm: 120, weightKg: 30 }, d, false).weightKg === 30, 'every-load repair keeps real edge values')
// --- post order
const nums = [504, 507, 501, 543, 503, 502, 538, 510, 509, 511]
const ps = nums.map((n) => ({ number: n, title: `t${n}` }))
const sorted = sortPosts(ps).map((p) => p.number)
ok(sorted.join(',') === [...nums].sort((a, b) => a - b).join(','), `posts sort strictly by number: ${sorted.join(' → ')}`)
ok(sorted[0] === 501 && sorted[1] === 502 && sorted[2] === 503, 'starts 501 → 502 → 503')
ok(sortPosts([{ number: '510' }, { number: 9 }, { number: 100 }]).map((p) => +p.number!).join(',') === '9,100,510', 'string numbers sort numerically, not as text')
ok(sortPosts([{ number: 0, title: 'x' }, { number: 502 }, { number: 501 }]).map((p) => p.number).join(',') === '501,502,0', 'posts without a number go last')
const n1 = neighbours(ps, 501), n2 = neighbours(ps, 502), nl = neighbours(ps, 543)
ok(n1.prev === null && n1.next?.number === 502, '#501: no previous, next #502')
ok(n2.prev?.number === 501 && n2.next?.number === 503, '#502: prev #501, next #503')
ok(nl.next === null && nl.prev?.number === 538, 'last post: no wrap-around')

console.log(failed ? `\n${failed} failed` : '\nAll unit + post order tests passed')
process.exit(failed ? 1 : 0)
