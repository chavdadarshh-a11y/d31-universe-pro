// v4.5.0 static checks: back-lever card, front-lever cards without the back-lever photo,
// Library lock config, prices switched off by default, no "for life" offer copy.
import fs from 'node:fs'
let failed = 0
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }
const rd = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const ex = rd('src/data/exercises.ts')
const block = (id) => { const i = ex.indexOf(`id: '${id}'`); return i < 0 ? '' : ex.slice(i, ex.indexOf('\n  },', i)) }
const bl = block('back-lever')
ok(!!bl && bl.includes("name: 'Back Lever'") && bl.includes("media: 'back-lever'"), 'Back Lever exercise exists with its photo')
ok(bl.includes("category: 'calisthenics'") && /tr: \{[\s\S]*hi: \{[\s\S]*gu: \{/.test(bl), 'Back Lever is calisthenics with hi + gu text')
for (const id of ['tuck-front-lever', 'adv-tuck-front-lever', 'one-leg-front-lever', 'straddle-front-lever', 'full-front-lever', 'front-lever-raise'])
  ok(block(id) && !/media: '(front|back)-lever'/.test(block(id)), `${id} kept its id and no longer shows the back-lever photo`)
ok(fs.existsSync(new URL('../public/media/back-lever.webp', import.meta.url)) && fs.existsSync(new URL('../public/media/back-lever-sm.webp', import.meta.url)), 'back-lever photo files exist')
ok(rd('src/config/library.ts').includes("LIBRARY_OPEN: Category[] = ['calisthenics']"), 'Library: only calisthenics open')
ok(/PRICES_ON_DEFAULT = false/.test(rd('src/config/prices.ts')), 'prices hidden by default (one flag)')
ok(/IN_APP = IN_TWA \|\| !PRICES_ON/.test(rd('src/lib/appMode.ts')), 'price-free mode applies to web + TWA')
const i18n = fs.readdirSync(new URL('../src/i18n/', import.meta.url)).map((f) => rd(`src/i18n/${f}`)).join('\n')
ok(!/for life|जीवन भर 25|આજીવન 25/.test(i18n), 'no "for life" membership offer copy')
for (const k of ['libSoon', 'libCount']) ok((rd('src/i18n/strings50.ts').match(new RegExp(`${k}:`, 'g')) ?? []).length === 3, `${k} in en/hi/gu`)
console.log(failed ? `\n${failed} failed` : '\nAll v4.5 checks passed')
process.exit(failed ? 1 : 0)
