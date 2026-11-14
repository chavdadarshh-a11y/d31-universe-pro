// Typed exercise names + auto-detect checks (run via npm test). Bundles the TS sources with esbuild in memory.
import { rolldown } from 'rolldown'
import fs from 'node:fs'
const bundle = await rolldown({ input: new URL('./exmatch-entry.ts', import.meta.url).pathname, platform: 'node', logLevel: 'silent' })
const { output } = await bundle.generate({ format: 'esm' })
const m = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'))
let failed = 0
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) failed++ }

const want = {
  'lat pulldown wide grip': ['lat-pulldown', 'wide'], 'let pull down': ['lat-pulldown'], 'lat pull down': ['lat-pulldown'], 'latpulldown': ['lat-pulldown'],
  'pulldown': ['lat-pulldown'], 'wide grip pulldown': ['lat-pulldown', 'wide'], 'close grip lat pulldown': ['lat-pulldown', 'close'],
  'reverse grip pulldown': ['lat-pulldown', 'reverse'], 'lat pulldwon': ['lat-pulldown'], 'laat pul daun': ['lat-pulldown'],
  'लैट पुलडाउन': ['lat-pulldown'], 'लेट पुल डाउन': ['lat-pulldown'], 'લેટ પુલડાઉન': ['lat-pulldown'], 'Lat Pulldown': ['lat-pulldown'],
  'seated row': ['seated-cable-row'], 'cable row': ['seated-cable-row'], 'pullup': ['pull-up'], 'chin up': ['chin-up'], 'dedlift': ['deadlift'],
  'bench': ['bench-press'], 'bicep curl': ['barbell-curl'], 'hammer curl': ['hammer-curl'], 'tricep pushdown': ['triceps-pushdown'],
  'shoulder press': ['overhead-press'], 'rdl': ['romanian-deadlift'], 'leg press': ['leg-press'], 'hip thrust': ['hip-thrust'],
}
for (const [q, [id, grip]] of Object.entries(want)) {
  const r = m.resolveExercise(q)
  ok(r?.id === id && (grip ? r.grip === grip : true), `"${q}" → ${id}${grip ? ' · ' + grip : ''} (got ${r ? r.id + ' ' + (r.grip ?? '') : 'none'})`)
}
for (const q of ['close grip', 'xyz', 'asdf qwer']) ok(m.resolveExercise(q) === null, `"${q}" is not guessed into an exercise`)
// grip changes emphasis
const wide = m.rolesFor('lat-pulldown', 'wide'), rev = m.rolesFor('lat-pulldown', 'reverse'), base = m.rolesFor('lat-pulldown')
ok(base.lats === 'primary' && base.teres_major === 'primary' && base.biceps === 'primary', 'lat pulldown: lats, teres major, biceps are primary')
ok(base.delt_post === 'secondary' && base.rhomboids === 'secondary' && base.traps_mid === 'secondary' && base.brachialis === 'secondary', 'lat pulldown: rear delt, rhomboids, mid/lower traps, brachialis secondary')
ok(base.erectors === 'stabilizer', 'lat pulldown: erectors stabilise')
ok(JSON.stringify(wide) !== JSON.stringify(rev), 'wide vs reverse grip change the muscle emphasis')

// auto-detect on real landmarks (MediaPipe full model + mirrored run, fixture from the test photos)
const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/pose-guess.json', import.meta.url), 'utf8'))
const guess = (k) => { const f = fx[k]; const lm = f.lm.map(([x, y, visibility, presence, z]) => ({ x, y, visibility, presence, z })); return m.guessExercise(m.buildPose(lm, f.w, f.h)) }
const lp = guess('lat-pulldown')
ok(lp[0]?.id === 'lat-pulldown' && lp[0].sure, `seated back-view pulldown photo → lat pulldown (got ${lp.map((g) => g.id).join(', ')})`)
ok(lp.every((g) => ['lat-pulldown', 'overhead-press', 'pull-up'].includes(g.id)), 'only plausible alternatives (no split holds)')
ok(JSON.stringify(guess('lat-pulldown')) === JSON.stringify(lp), 'same landmarks → same answer')
ok(guess('overhead-press')[0]?.id === 'overhead-press', 'seated front-view dumbbell press → overhead press')
ok(guess('back-squat')[0]?.id === 'back-squat', 'squat still detected')
ok(guess('hip-thrust')[0]?.id === 'hip-thrust', 'hip thrust still detected')
console.log(failed ? `\n${failed} exercise-match check(s) FAILED` : '\nAll exercise-match checks passed')
process.exit(failed ? 1 : 0)
