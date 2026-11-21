// Pure-logic checks for v4.5 beta: runs, game, range levels.
import assert from 'node:assert/strict'
import { haversine, acceptFix, splitsFrom, segAt, planSec, fmtPace } from '../src/lib/runs.ts'
import { levelOf, comboMult, xpForLevel } from '../src/lib/game.ts'
import { romFamily, romFromAngle, EX_ROM } from '../src/data/rom.ts'
import { EXERCISES } from '../src/data/exercises.ts'

const d = haversine([22.3, 70.8], [22.309, 70.8]); assert.ok(Math.abs(d - 1000) < 15, `haversine ${d}`)
assert.equal(acceptFix(null, { lat: 1, lng: 1, acc: 5, t: 0 }).ok, true)
assert.equal(acceptFix({ lat: 22.3, lng: 70.8, acc: 5, t: 0 }, { lat: 22.4, lng: 70.8, acc: 5, t: 1000 }).ok, false, 'teleport rejected')
assert.equal(acceptFix({ lat: 22.3, lng: 70.8, acc: 5, t: 0 }, { lat: 22.3, lng: 70.8, acc: 80, t: 1000 }).ok, false, 'bad accuracy rejected')
const sp = splitsFrom([[0, 0], [1000, 300], [2000, 620], [2200, 700]]); assert.equal(sp.length, 2); assert.ok(Math.abs(sp[0] - 300) < 1 && Math.abs(sp[1] - 320) < 1, `splits ${sp}`)
assert.equal(planSec('intervals'), 5 * 60 * 2 + 6 * 180)
assert.equal(segAt('intervals', 301)?.seg.kind, 'fast')
assert.equal(fmtPace(330), '5:30')
assert.equal(levelOf(0).level, 1); assert.equal(levelOf(xpForLevel(1)).level, 2)
assert.equal(comboMult(0), 1); assert.equal(comboMult(5), 1.5); assert.equal(comboMult(100), 3)
const sq = romFamily('back-squat'); assert.equal(sq.id, 'squat')
assert.equal(romFromAngle(sq, 150), null); assert.equal(sq.levels[romFromAngle(sq, 70)!].id, sq.levels[sq.levels.length - 1].id)
for (const e of EXERCISES) assert.ok(EX_ROM[e.id] || romFamily(e).levels.length >= 2, `rom for ${e.id}`)
for (const f of Object.values((await import('../src/data/rom.ts')).ROM_FAMILIES)) for (const l of f.levels) assert.ok(l.name.en && l.name.hi && l.name.gu && l.desc.en && l.desc.hi && l.desc.gu, `${f.id}/${l.id} translated`)
console.log(`beta features ok · ${EXERCISES.length} exercises have range levels`)
