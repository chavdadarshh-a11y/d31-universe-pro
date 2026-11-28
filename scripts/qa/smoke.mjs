// D31 QA smoke — headless mobile (412×915) crawl + real-typing checks. Run before EVERY deploy:
//   BASE=http://127.0.0.1:4173/d31-universe-pro/ node scripts/qa/smoke.mjs          (local build)
//   BASE=https://chavdadarshh-a11y.github.io/d31-universe-pro/beta/ node scripts/qa/smoke.mjs   (beta)
// Env: OUT (screenshots dir), PW (path to playwright-core index.mjs), CHROME (browser path), FEED (posts.json URL).
// Exit code 1 when anything fails. Checks:
//  • every route: no page errors / console errors, no ₹ prices, no "lifetime", no horizontal overflow, no broken <img>
//  • height / weight / age: real typing (25, 175, 80), backspace, no revert after 2 s, reload keeps values,
//    −/+ buttons, kg↔lb and cm↔in toggles round-trip without drift, corrupted saved values repaired
//  • posts: Today cascade 1/N = lowest number, strictly ascending; detail ‹ › goes 501 → 502 → 503, no wrap at the ends;
//    tab counts equal rows; PDF covers load in EN / HI / GU
//  • HTTP: every PDF cover thumbnail and the knowledge feed answer 200
import fs from 'node:fs'
const PW = process.env.PW || '/workspace/build/pw/node_modules/playwright-core/index.mjs'
const { chromium } = await import(PW).catch(() => import('playwright-core')).catch(() => import('playwright'))
const BASE = (process.env.BASE || 'http://127.0.0.1:4173/d31-universe-pro/').replace(/\/?$/, '/')
const OUT = process.env.OUT || '/tmp/d31-qa'
const CHROME = process.env.CHROME || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined)
fs.mkdirSync(OUT, { recursive: true })
const up = await fetch(BASE).then((r) => r.status).catch((e) => String(e))
if (up !== 200) { console.log(`FAIL ${BASE} is not reachable (${up}) — start the server first`); process.exit(1) }

const res = []
const ok = (n, c, x = '') => { res.push({ n, c: !!c, x }); console.log(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`) }
const BENIGN = /favicon|ERR_INTERNET_DISCONNECTED|net::ERR|Failed to load resource|supabase|googletagmanager|gsi\/client|accounts\.google|WebGL|GL_|gpu|pdf\.worker|Warning: TT:|MediaPipe|wasm|cdn\.jsdelivr|fonts\.g|chrome-extension|goatcounter|getUserMedia|Permission|NotAllowedError|NotFoundError|Requested device/i
const tid = (p, id) => p.locator(`[data-testid="${id}"]`)
const go = async (p, h, ms = 1500) => { await p.evaluate((h) => { location.hash = h }, h); await p.waitForTimeout(ms) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ROUTES = ['#/home', '#/train', '#/analyze', '#/analyze/moments', '#/analyze/ask', '#/analyze/search', '#/library', '#/library?tab=shoot',
  '#/library/pull-up', '#/library/deadlift', '#/library/pec-deck', '#/library/face-pull', '#/library/barbell-row', '#/library/battle-ropes',
  '#/library/seated-cable-row', '#/library/dumbbell-bench-press', '#/library/hanging-knee-raise', '#/knowledge', '#/membership', '#/stats',
  '#/player', '#/progress', '#/profile', '#/settings', '#/fuel', '#/train/run', '#/train/game', '#/train/builder', '#/train/program/foundation',
  '#/downloads', '#/referral', '#/legal/privacy', '#/legal/terms', '#/knowledge/511', '#/knowledge/501']
const ROUTES_I18N = ['#/home', '#/train', '#/analyze', '#/library', '#/knowledge/511', '#/progress', '#/profile', '#/membership']

const PROFILE_BAD = { name: 'QA', goal: 'muscle', level: 'beginner', equipment: ['none'], sex: 'male', age: 90, heightCm: 120, weightKg: 30, activity: 1.375 }
const seed = (profile = PROFILE_BAD, unit = 'kg', len = 'cm', lang = 'en') => {
  return ({ profile, unit, len, lang }) => {
    if (sessionStorage.getItem('qa-seeded')) return
    sessionStorage.setItem('qa-seeded', '1')
    localStorage.setItem('d31-settings', JSON.stringify({ state: { theme: 'night', sound: false, weightUnit: unit, lengthUnit: len }, version: 1 }))
    localStorage.setItem('d31-pro-v1', JSON.stringify({ state: { onboarded: true, lang, profile }, version: 5 }))
  }
}
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const newPage = async (init) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' })
  if (init) await ctx.addInitScript(init.fn, init.arg)
  const p = await ctx.newPage()
  p.errs = []
  p.on('pageerror', (e) => p.errs.push('pageerror: ' + String(e).slice(0, 200)))
  p.on('console', (m) => { if (m.type() === 'error' && !BENIGN.test(m.text())) p.errs.push('console: ' + m.text().slice(0, 200)) })
  return { ctx, p }
}
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('d31-pro-v1') || '{}').state?.profile)

// ── 1. route crawl ─────────────────────────────────────────────
{
  const { ctx, p } = await newPage({ fn: seed(), arg: { profile: { ...PROFILE_BAD, age: 30, heightCm: 175, weightKg: 80 }, unit: 'kg', len: 'cm', lang: 'en' } })
  await p.goto(BASE + '#/home', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  await p.waitForTimeout(1500)
  const crawl = [...ROUTES.map((r) => ['en', r]), ...['hi', 'gu'].flatMap((l) => ROUTES_I18N.map((r) => [l, r]))]
  for (const [lang, r] of crawl) {
    if (lang !== 'en') await p.evaluate((l) => { const k = 'd31-pro-v1'; const s = JSON.parse(localStorage.getItem(k)); if (s.state.lang !== l) { s.state.lang = l; localStorage.setItem(k, JSON.stringify(s)); location.reload() } }, lang).catch(() => {})
    if (lang !== 'en') await p.waitForTimeout(800)
    p.errs.length = 0
    await go(p, r, 1800)
    const d = await p.evaluate(() => {
      const t = document.body.innerText
      const imgs = [...document.querySelectorAll('img')].filter((i) => i.complete && i.loading !== 'lazy' && i.getBoundingClientRect().width > 0 && i.naturalWidth === 0 && (i.currentSrc || i.src)).map((i) => (i.currentSrc || i.src).slice(0, 90))
      const clipped = [...document.querySelectorAll('input')].filter((i) => i.offsetParent && i.type !== 'range' && i.type !== 'checkbox' && i.value && i.scrollWidth > i.clientWidth + 1 && !i.matches('[type=search],[type=email],[type=text]:not([inputmode])')).map((i) => i.getAttribute('aria-label') || i.name || 'input')
      const nf = !!document.querySelector('[data-testid="not-found"]')
      return { clipped, nf, rupee: /₹|Rs\.?\s*\d|INR\s*\d/.test(t), life: /lifetime/i.test(t), over: document.documentElement.scrollWidth - window.innerWidth, imgs }
    })
    const bad = [d.clipped.length && `clipped number field ${d.clipped.join(',')}`, d.nf && 'NotFound screen', d.rupee && '₹ visible', d.life && '"lifetime"', d.over > 2 && `horizontal overflow ${d.over}px`, d.imgs.length && `broken img ${d.imgs.join(', ')}`, ...p.errs].filter(Boolean)
    ok(`route ${lang} ${r}`, bad.length === 0, bad.join(' | '))
  }
  await ctx.close()
}

// ── 2. height / weight / age — real typing ─────────────────────
const openBody = async (p) => {
  await go(p, '#/profile', 1500)
  await tid(p, 'edit-profile').click()
  await p.waitForTimeout(600)
  for (let i = 0; i < 3; i++) { await tid(p, 'ob-next').last().click(); await p.waitForTimeout(350) }
  await tid(p, 'ob-age').waitFor({ timeout: 5000 })
}
const val = (p, id) => tid(p, id).locator('input').inputValue()
const typeInto = async (p, id, txt) => { const i = tid(p, id).locator('input'); await i.tap(); await p.waitForTimeout(150); await i.press('Control+a'); await i.press('Backspace'); await p.keyboard.type(txt, { delay: 120 }) }
{
  const { ctx, p } = await newPage({ fn: seed(), arg: { profile: PROFILE_BAD, unit: 'kg', len: 'cm', lang: 'en' } })
  await p.goto(BASE + '#/home', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  await p.waitForTimeout(1200)
  const rep = await store(p)
  ok('corrupted saved body values (90 / 120 / 30) repaired on load', rep?.age === 25 && rep?.heightCm === 172 && rep?.weightKg === 70, JSON.stringify(rep && { age: rep.age, h: rep.heightCm, w: rep.weightKg }))
  await openBody(p)
  // focus must not change the value
  const h0 = await val(p, 'ob-height'); await tid(p, 'ob-height').locator('input').tap(); await p.waitForTimeout(700)
  ok('tapping height does not change it', (await val(p, 'ob-height')) === h0, `${h0} → ${await val(p, 'ob-height')}`)
  await typeInto(p, 'ob-age', '25'); const a1 = await val(p, 'ob-age')
  await typeInto(p, 'ob-height', '175'); const h1 = await val(p, 'ob-height')
  await typeInto(p, 'ob-weight', '80'); const w1 = await val(p, 'ob-weight')
  ok('typing 25 / 175 / 80 shows exactly what was typed', a1 === '25' && h1 === '175' && w1 === '80', `${a1} / ${h1} / ${w1}`)
  await p.waitForTimeout(2000)
  ok('no auto-revert after 2 s while focused', (await val(p, 'ob-weight')) === '80', await val(p, 'ob-weight'))
  // backspace then retype
  const wi = tid(p, 'ob-weight').locator('input'); await wi.press('End'); await wi.press('Backspace')
  ok('backspace leaves "8" (no jump to min)', (await val(p, 'ob-weight')) === '8', await val(p, 'ob-weight'))
  await p.keyboard.type('2.5', { delay: 120 })
  ok('decimal typing works (82.5)', (await val(p, 'ob-weight')) === '82.5', await val(p, 'ob-weight'))
  await p.locator('h1,h2,.label').first().tap().catch(() => {}); await tid(p, 'ob-age').locator('input').blur(); await p.waitForTimeout(400)
  // out-of-range typed value is clamped only on blur
  await typeInto(p, 'ob-height', '300'); ok('while typing 300 the field shows 300', (await val(p, 'ob-height')) === '300')
  await tid(p, 'ob-height').locator('input').press('Enter'); await p.waitForTimeout(300)
  ok('out of range clamps on Enter/blur to 250', (await val(p, 'ob-height')) === '250', await val(p, 'ob-height'))
  await typeInto(p, 'ob-height', '175'); await tid(p, 'ob-height').locator('input').press('Enter')
  // − / +
  await tid(p, 'ob-weight').getByLabel('Increase').tap(); await p.waitForTimeout(200)
  ok('+ adds 0.5 kg (83)', (await val(p, 'ob-weight')) === '83', await val(p, 'ob-weight'))
  await tid(p, 'ob-weight').getByLabel('Decrease').tap(); await p.waitForTimeout(200)
  ok('− subtracts 0.5 kg (82.5)', (await val(p, 'ob-weight')) === '82.5', await val(p, 'ob-weight'))
  const clip = await p.evaluate(() => ['ob-age', 'ob-height', 'ob-weight'].map((id) => { const i = document.querySelector(`[data-testid="${id}"] input`); return i && i.scrollWidth > i.clientWidth + 1 ? id : null }).filter(Boolean))
  ok('body inputs are wide enough (no clipped digits)', clip.length === 0, clip.join(','))
  await p.screenshot({ path: `${OUT}/body-typed.png` })
  const s1 = await store(p)
  ok('store keeps metric 25 y / 175 cm / 82.5 kg', s1.age === 25 && s1.heightCm === 175 && s1.weightKg === 82.5, JSON.stringify({ a: s1.age, h: s1.heightCm, w: s1.weightKg }))
  // finish + reload
  await tid(p, 'ob-next').last().click(); await p.waitForTimeout(800)
  await p.reload({ waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(1200)
  const s2 = await store(p)
  ok('values survive reload (no reset, no 230)', s2.age === 25 && s2.heightCm === 175 && s2.weightKg === 82.5, JSON.stringify({ a: s2.age, h: s2.heightCm, w: s2.weightKg }))
  // unit toggles: display converts, stored value never changes
  for (let i = 0; i < 4; i++) {
    await p.evaluate((u) => { const k = 'd31-settings'; const s = JSON.parse(localStorage.getItem(k) || '{"state":{}}'); s.state.weightUnit = u; s.state.lengthUnit = u === 'lb' ? 'in' : 'cm'; localStorage.setItem(k, JSON.stringify(s)) }, i % 2 ? 'kg' : 'lb')
    await p.reload({ waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(900)
  }
  await p.evaluate(() => { const k = 'd31-settings'; const s = JSON.parse(localStorage.getItem(k)); s.state.weightUnit = 'lb'; s.state.lengthUnit = 'in'; localStorage.setItem(k, JSON.stringify(s)) })
  await p.reload({ waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(900)
  await openBody(p)
  ok('lb / in display: 181.9 lb, 68.9 in', (await val(p, 'ob-weight')) === '181.9' && (await val(p, 'ob-height')) === '68.9', `${await val(p, 'ob-weight')} lb / ${await val(p, 'ob-height')} in`)
  await p.screenshot({ path: `${OUT}/body-lb.png` })
  const s3 = await store(p)
  ok('unit toggles ×5 never change stored kg / cm', s3.weightKg === 82.5 && s3.heightCm === 175, JSON.stringify({ h: s3.heightCm, w: s3.weightKg }))
  await typeInto(p, 'ob-weight', '176'); await tid(p, 'ob-weight').locator('input').press('Enter'); await p.waitForTimeout(300)
  ok('typing 176 lb keeps showing 176 (no drift)', (await val(p, 'ob-weight')) === '176', await val(p, 'ob-weight'))
  // Progress → Body → add measurement (lb mode): typing 180 lb saves 81.65 kg and shows 180 lb
  await go(p, '#/progress', 1500)
  await tid(p, 'tab-body').click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: /add measurement/i }).first().click(); await p.waitForTimeout(600)
  await typeInto(p, 'm-weightKg', '180'); await tid(p, 'm-weightKg').locator('input').press('Enter'); await p.waitForTimeout(200)
  ok('measurement weight field keeps 180 (lb)', (await val(p, 'm-weightKg')) === '180', await val(p, 'm-weightKg'))
  await p.getByRole('button', { name: /^save$/i }).last().click(); await p.waitForTimeout(600)
  const ms = await p.evaluate(() => JSON.parse(localStorage.getItem('d31-pro-v1')).state)
  const last = ms.measurements?.[ms.measurements.length - 1]
  ok('measurement saved in kg (81.6–81.7) and profile weight follows', last && Math.abs(last.weightKg - 81.65) < 0.05 && Math.abs(ms.profile.weightKg - 81.65) < 0.05, JSON.stringify({ m: last?.weightKg, p: ms.profile.weightKg }))
  ok('page errors: 0', p.errs.length === 0, p.errs.join(' | '))
  await ctx.close()
}

// ── 3. posts: order, next/prev, tab counts, PDF covers ─────────
const FEED = process.env.FEED || 'https://chavdadarshh-a11y.github.io/d31-universe-pro/knowledge/posts.json'
const feed = await fetch(FEED).then((r) => { ok(`feed ${FEED} → ${r.status}`, r.ok); return r.json() }).catch(() => ({ posts: [] }))
const vis = feed.posts.filter((x) => !x.empty).map((x) => x.number).sort((a, b) => a - b)
{
  const { ctx, p } = await newPage({ fn: seed(), arg: { profile: { ...PROFILE_BAD, age: 30, heightCm: 175, weightKg: 80 }, unit: 'kg', len: 'cm', lang: 'en' } })
  await p.emulateMedia({ reducedMotion: 'no-preference' })
  await p.goto(BASE + '#/home', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
  await tid(p, 'ks-current').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {})
  const first = await p.evaluate(() => { const s = document.querySelector('[data-testid="ks-current"]'); return s ? +(s.textContent.match(/#(\d+)/) || [])[1] : null })
  await p.waitForTimeout(1200)
  const cur = async () => p.evaluate(() => { const s = document.querySelector('[data-testid="ks-current"]'); return s ? +(s.textContent.match(/#(\d+)/) || [])[1] : null })
  const seen = []
  if (await tid(p, 'ks-current').count()) {
    // pause autoplay by interacting, then walk with the ▼ (next) arrow
    await p.locator('.pc-arrow').first().click(); await p.waitForTimeout(1700) // ▲ once: pauses autoplay
    await p.locator('.pc-arrow').last().click(); await p.waitForTimeout(1700)
    seen.push(await cur())
    for (let i = 1; i < Math.min(vis.length, 12); i++) { await p.locator('.pc-arrow').last().click(); await p.waitForTimeout(1700); seen.push(await cur()) }
  }
  const asc = seen.every((n, i) => i === 0 || vis.indexOf(n) === vis.indexOf(seen[i - 1]) + 1)
  ok('Today cascade: first card on open = lowest post number', first === vis[0], `first #${first}, expected #${vis[0]}`)
  ok('Today cascade: ▼ goes to the very next number each time', asc && seen.length > 1, seen.join(' → '))
  await p.screenshot({ path: `${OUT}/today-cascade.png` })
  // detail next / prev
  await go(p, `#/knowledge/${vis[0]}`, 2500)
  ok(`#${vis[0]}: no "previous" at the first post`, (await tid(p, 'kpost-prev').count()) === 0)
  const chain = [vis[0]]
  for (let i = 0; i < 3 && (await tid(p, 'kpost-next').count()); i++) {
    await tid(p, 'kpost-next').click(); await p.waitForTimeout(1800)
    chain.push(+(await p.evaluate(() => location.hash.match(/(\d+)$/)?.[1])))
  }
  ok('detail ›: 501 → 502 → 503 → 504', chain.join(',') === vis.slice(0, chain.length).join(','), chain.join(' → '))
  await p.evaluate(() => document.querySelector('[data-testid="kpost-nav"]')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/post-next-prev.png` })
  await tid(p, 'kpost-prev').click(); await p.waitForTimeout(1500)
  ok('detail ‹ goes back one', (await p.evaluate(() => location.hash)).endsWith(`/${chain[chain.length - 2]}`), await p.evaluate(() => location.hash))
  await go(p, `#/knowledge/${vis[vis.length - 1]}`, 2000)
  ok(`last post #${vis[vis.length - 1]}: no "next" (no wrap-around)`, (await tid(p, 'kpost-next').count()) === 0)
  // every visible post × 3 languages: tab counts = rows, PDF covers load
  const sample = process.env.QUICK ? [...new Set([vis[0], vis[1], vis[2], 511, vis[vis.length - 1]])] : vis
  for (const n of sample) {
    await go(p, `#/knowledge/${n}`, 1600)
    if (await tid(p, 'kpost-soon').count()) continue
    for (const l of ['en', 'hi', 'gu']) {
      await tid(p, `k-lang-${l}`).click().catch(() => {}); await p.waitForTimeout(300)
      for (const tab of ['videos', 'pdfs', 'photos']) {
        const lbl = await tid(p, `tab-${tab}`).innerText().catch(() => '')
        const want = +(lbl.match(/(\d+)\s*$/) || [])[1]
        await tid(p, `tab-${tab}`).click(); await p.waitForTimeout(tab === 'pdfs' ? 1400 : 350)
        const rows = tab === 'photos' ? await tid(p, 'k-photos').locator('img').count() : await p.locator('[data-testid="k-file"],[data-testid="k-file-locked"]').count()
        if (rows !== want) ok(`#${n} ${l} ${tab}: tab says ${want}, shows ${rows}`, false)
        if (tab === 'pdfs' && rows) {
          await p.evaluate(async () => { for (const el of document.querySelectorAll('[data-testid="pdf-cover"]')) { el.scrollIntoView(); await new Promise((r) => setTimeout(r, 250)) } })
          await p.waitForTimeout(800)
          const c = await p.evaluate(() => ({ covers: document.querySelectorAll('[data-testid="pdf-cover"] img').length, loaded: [...document.querySelectorAll('[data-testid="pdf-cover"] img')].filter((i) => i.naturalWidth > 0).length, fb: document.querySelectorAll('[data-testid="pdf-cover-fallback"]').length }))
          if (c.covers + c.fb !== rows || c.loaded !== c.covers) ok(`#${n} ${l}: PDF covers`, false, JSON.stringify(c))
          if (n === 511) { await p.evaluate(() => { const t = document.querySelector('[role="tablist"]'); window.scrollTo(0, (t?.getBoundingClientRect().top ?? 0) + window.scrollY - 70) }); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/pdf-${l}-511.png` }) }
        }
      }
    }
  }
  ok('every post: tab counts match rows and PDF covers load (EN/HI/GU)', !res.some((r) => !r.c && /^#\d+ /.test(r.n)))
  ok('posts: page errors 0', p.errs.length === 0, p.errs.slice(0, 5).join(' | '))
  await ctx.close()
}

// ── 4. HTTP: every PDF cover thumbnail ─────────────────────────
{
  const ids = [...new Set(feed.posts.filter((x) => !x.empty).flatMap((x) => Object.values(x.pdfs).flat().map((f) => f.id)))]
  const bad = []
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async (id) => {
      const r = await fetch(`https://lh3.googleusercontent.com/d/${id}=w400`).catch(() => null)
      if (!r || !r.ok || !/image/.test(r.headers.get('content-type') || '')) bad.push(`${id}:${r?.status}`)
    }))
    await sleep(50)
  }
  ok(`PDF cover thumbnails HTTP 200 (${ids.length - bad.length}/${ids.length})`, bad.length === 0, bad.slice(0, 8).join(' '))
}

await browser.close()
const failed = res.filter((r) => !r.c)
fs.writeFileSync(`${OUT}/qa-report.json`, JSON.stringify(res, null, 2))
console.log(`\n=== QA: ${res.length - failed.length}/${res.length} passed ===`)
for (const f of failed) console.log('FAIL', f.n, f.x)
process.exit(failed.length ? 1 : 0)
