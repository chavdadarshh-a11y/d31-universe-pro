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
ok(rd('src/config/library.ts').includes("LIBRARY_OPEN: Category[] = ['calisthenics']"), 'Library: calisthenics list kept for easy revert')
ok(/VIEW_ALL_OPEN = envOn\('VITE_VIEW_ALL_OPEN', true\)/.test(rd('src/config/access.ts')), 'VIEW_ALL_OPEN flag defaults on')
ok(/DOWNLOAD_LOCK = envOn\('VITE_DOWNLOAD_LOCK', true\)/.test(rd('src/config/access.ts')), 'DOWNLOAD_LOCK flag defaults on')
ok(rd('src/config/library.ts').includes('VIEW_ALL_OPEN'), 'libLocked respects VIEW_ALL_OPEN')
ok(!/PRICES_ON_DEFAULT = true/.test(rd('src/config/prices.ts')), 'prices stay hidden')
ok(/PRICES_ON_DEFAULT = false/.test(rd('src/config/prices.ts')), 'prices hidden by default (one flag)')
ok(/IN_APP = IN_TWA \|\| !PRICES_ON/.test(rd('src/lib/appMode.ts')), 'price-free mode applies to web + TWA')
const i18n = fs.readdirSync(new URL('../src/i18n/', import.meta.url)).map((f) => rd(`src/i18n/${f}`)).join('\n')
ok(!/for life|जीवन भर 25|આજીવન 25/.test(i18n), 'no "for life" membership offer copy')
for (const k of ['libSoon', 'libCount']) ok((rd('src/i18n/strings50.ts').match(new RegExp(`${k}:`, 'g')) ?? []).length === 3, `${k} in en/hi/gu`)
const ko = rd('src/config/knowledgeOpen.ts')
ok(/OPEN_POSTS: number\[\] = \[\d+, \d+, \d+\]/.test(ko) && /videos: 3, pdfs: 3, photos: 3/.test(ko), 'Knowledge: 3 open posts, 3 videos / 3 PDFs per language, 3 photos')
ok(/gameTitle: "FUN MODE"/.test(rd('src/i18n/strings48.ts')) && !/GAME MODE|गेम मोड|ગેમ મોડ/.test(rd('src/i18n/strings48.ts')), 'Game mode renamed to Fun mode (en/hi/gu)')
console.log(failed ? `\n${failed} failed` : '\nAll v4.5 checks passed')
process.exit(failed ? 1 : 0)
