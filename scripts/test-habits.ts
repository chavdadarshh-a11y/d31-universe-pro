// Unit tests: daily plan, streak / best streak, guest → account merge, reminder schedule (run: npm test).
import { readFileSync } from 'node:fs'
import { dailyPlan, streak, bestStreak, weekStrip, isDoneOn, nextFire, DAILY_PLAN_EX_IDS } from '../src/lib/habits.ts'
import { estimateMinutes } from '../src/lib/plan.ts'
import { mergeGuestState } from '../src/lib/guestMerge.ts'

let failed = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }

// --- daily plan: every goal × level × weekday is 10–15 min and uses real exercise ids
const ids = new Set([...readFileSync(new URL('../src/data/exercises.ts', import.meta.url), 'utf8').matchAll(/id: '([^']+)'/g)].map((m) => m[1]))
ok(DAILY_PLAN_EX_IDS.every((id) => ids.has(id)), `daily plan uses only library exercises (${DAILY_PLAN_EX_IDS.join(', ')})`)
let bad: string[] = []
for (const goal of ['muscle', 'fatloss', 'strength', 'skills', 'mobility'] as const) for (const level of ['beginner', 'intermediate', 'advanced'] as const) for (let d = 0; d < 7; d++) {
  const p = dailyPlan(new Date(2026, 10, 22 + d), goal, level)
  const m = estimateMinutes(p.items)
  if (m < 10 || m > 15 || p.items.length < 4) bad.push(`${goal}/${level}/${d}=${m}`)
}
ok(bad.length === 0, `every goal × level × weekday plan is 10–15 min ${bad.slice(0, 5).join(' ')}`)
const a = dailyPlan(new Date(2026, 10, 28, 7), 'muscle', 'beginner'), b = dailyPlan(new Date(2026, 10, 28, 22), 'muscle', 'beginner')
ok(JSON.stringify(a) === JSON.stringify(b), 'same plan all day (morning = night)')

// --- streak: sessions + "Workout done" taps, only real data
const now = new Date(2026, 10, 28, 18, 0)
const sess = (y: number, m: number, d: number) => ({ id: `s${y}${m}${d}`, name: 'x', startedAt: new Date(y, m, d, 9).toISOString(), durationSec: 600, volumeKg: 0, exercises: [], source: 'player' as const })
ok(streak([], [], now) === 0, 'no data → streak 0 (no fake numbers)')
ok(streak([], ['2026-11-28'], now) === 1, 'tap Workout done today → streak 1')
ok(streak([], ['2026-11-27'], now) === 1, 'done yesterday, not yet today → streak still 1 (today not lost yet)')
ok(streak([], ['2026-11-26'], now) === 0, 'missed yesterday → streak 0')
ok(streak([sess(2026, 10, 27)], ['2026-11-28', '2026-11-26'], now) === 3, 'session + taps combine (26, 27, 28 → 3)')
ok(streak([], ['2026-10-31', '2026-11-01'], new Date(2026, 10, 1, 8)) === 2, 'streak crosses a month boundary')
ok(bestStreak([], ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10', '2026-11-11']) === 3, 'best streak = longest run (3)')
ok(bestStreak([], []) === 0, 'best streak 0 with no data')
const wk = weekStrip([], ['2026-11-28', '2026-11-25'], now)
ok(wk.length === 7 && wk[6].done && wk[3].done && !wk[5].done, 'week strip marks only real days')
ok(isDoneOn('2026-11-27', [sess(2026, 10, 27)], []), 'a logged workout counts as done for that day')

// --- guest → account merge: union, idempotent, account wins
const acc = { onboarded: true, profile: { name: 'Darshan', goal: 'skills' }, sessions: [sess(2026, 10, 20)], measurements: [{ id: 'm1', date: '2026-11-01', weightKg: 70 }], doneDays: ['2026-11-20'], checkins: [{ date: '2026-11-20', score: 9 }], water: { '2026-11-20': 4 } }
const guest = { onboarded: true, profile: { name: '', goal: 'fatloss' }, sessions: [sess(2026, 10, 27), sess(2026, 10, 20)], measurements: [{ id: 'g1', date: '2026-11-25', weightKg: 69 }], doneDays: ['2026-11-28', '2026-11-20'], checkins: [{ date: '2026-11-20', score: 3 }, { date: '2026-11-27', score: 7 }], water: { '2026-11-20': 2, '2026-11-27': 6 } }
const m1 = mergeGuestState(acc, guest) as typeof acc
ok(m1.sessions.length === 2 && m1.sessions[0].id === 's20261027', 'guest workouts are added, no duplicates, newest first')
ok(m1.measurements.length === 2 && m1.measurements[1].id === 'g1', 'guest bodyweight entries are added (sorted by date)')
ok(m1.doneDays.join() === '2026-11-20,2026-11-28', 'guest "Workout done" days are added')
ok(m1.checkins.find((c) => c.date === '2026-11-20')?.score === 9 && m1.checkins.length === 2, 'account wins on the same check-in date')
ok(m1.water['2026-11-20'] === 4 && m1.water['2026-11-27'] === 6, 'water keeps the higher count per day')
ok((m1.profile as { goal: string }).goal === 'skills', 'an onboarded account keeps its own goal')
ok(JSON.stringify(mergeGuestState(m1, guest)) === JSON.stringify(m1), 'merging twice changes nothing (idempotent)')
const m2 = mergeGuestState({ onboarded: false, profile: { name: 'New' }, sessions: [] }, guest) as { onboarded: boolean; profile: { name: string; goal: string } }
ok(m2.onboarded && m2.profile.goal === 'fatloss' && m2.profile.name === 'New', 'a new account takes the guest’s set-up goal, keeps its name')
ok(mergeGuestState(acc, null) === acc, 'no guest data → account unchanged')

// --- reminder schedule: max once a day, skips a done day
const r = { enabled: true, time: '18:30', days: [0, 1, 2, 3, 4, 5, 6] }
ok(nextFire(r, new Date(2026, 10, 28, 9, 0))?.getHours() === 18 && nextFire(r, new Date(2026, 10, 28, 9, 0))?.getDate() === 28, 'before the time → today 18:30')
ok(nextFire(r, new Date(2026, 10, 28, 9, 0), true)?.getDate() === 29, 'already done today → tomorrow')
ok(nextFire(r, new Date(2026, 10, 28, 19, 0))?.getDate() === 29, 'after the time → tomorrow')
ok(nextFire({ ...r, days: [1] }, new Date(2026, 10, 28, 9, 0))?.getDay() === 1, 'respects chosen weekdays (next Monday)')
ok(nextFire({ ...r, enabled: false }, now) === null, 'off → nothing scheduled')

console.log(failed ? `\n${failed} habit check(s) failed` : '\nAll habit checks passed')
process.exit(failed ? 1 : 0)
