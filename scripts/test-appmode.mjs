import { chromium } from '/workspace/build/pw/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:8941/d31-universe-pro/'
const OUT = process.argv[3] || '/workspace/d31-play/test-appmode'; fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const res = []; const ok = (n, c, x = '') => { res.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); console.log(res.at(-1)) }
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const BAD = /₹|razorpay|\bUPI\b|\bupgrade\b|\bbuy\b|(?<!auto-)\brenew\b|prices in INR|\/day\b|Get Pro|mini pack|unlock this|choose (pro|gold|platinum)\b|खरीद|ખરીદ|अपग्रेड|અપગ્રેડ|रिन्यू करें|રિન્યૂ કરો|INR/i
async function ctxPage() {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: 'block' })
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
  const rz = []; p.on('request', (r) => { if (/razorpay/i.test(r.url())) rz.push(r.url()) })
  return { ctx, p, errs, rz }
}
async function onboard(p, url, opts) {
  await p.goto(url, opts); await p.waitForTimeout(1500)
  const tid = (id) => p.locator(`[data-testid="${id}"]`)
  if (await tid('ob-guest').isVisible().catch(() => false)) { await tid('ob-guest').click(); await p.waitForTimeout(300) }
  for (let i = 0; i < 6 && await tid('ob-next').isVisible().catch(() => false); i++) { await tid('ob-next').click(); await p.waitForTimeout(300) }
}
const routes = ['/home', '/membership', '/train', '/train/program/lever-lab', '/library', '/knowledge', '/knowledge/501', '/profile', '/downloads', '/progress', '/analyze', '/settings', '/legal/terms', '/legal/refunds', '/fuel']
const text = (p) => p.evaluate(() => document.body.innerText)
const goH = async (p, h) => { await p.evaluate((h) => { location.hash = h }, h); await p.waitForTimeout(1300) }

// 1) WEB (no flag) — buying visible
{
  const { ctx, p, errs } = await ctxPage()
  await onboard(p, BASE + '#/home')
  ok('web: app-store flag off', (await p.evaluate(() => document.documentElement.dataset.appStore)) === '0')
  await goH(p, '/membership')
  const buys = await p.locator('[data-testid^="buy-"]').count()
  ok('web: Membership shows buy buttons', buys >= 3, `buy buttons=${buys}`)
  ok('web: Membership shows ₹ prices', /₹\d/.test(await text(p)))
  ok('web: à-la-carte card visible', await p.locator('[data-testid="ala-card"]').isVisible())
  await p.screenshot({ path: `${OUT}/web-membership.png` })
  await goH(p, '/knowledge/501'); await p.locator('[data-testid="k-lang-hi"]').click().catch(() => {}); await p.waitForTimeout(400)
  await p.getByText(/^Videos/).first().click().catch(() => {}); await p.waitForTimeout(700)
  const kt = await text(p); ok('web: Knowledge locked item shows ₹ price', /₹\d/.test(kt))
  await p.screenshot({ path: `${OUT}/web-knowledge-hi-videos.png` })
  ok('web: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
  await ctx.close()
}
// 2) APP via ?src=twa — nothing to buy, anywhere, in all 3 languages
for (const [label, url] of [['?src=twa', BASE + '?src=twa#/home'], ['?utm_source=twa', BASE + '?utm_source=twa#/home']]) {
  const { ctx, p, errs, rz } = await ctxPage()
  await onboard(p, url)
  ok(`app(${label}): flag on`, (await p.evaluate(() => document.documentElement.dataset.appStore)) === '1')
  for (const lang of ['en', 'hi', 'gu']) {
    if (lang !== 'en') { await p.evaluate((l) => { const k = Object.keys(localStorage).find((x) => /d31.*app|app.*d31/i.test(x)); return k }, lang) }
    if (lang !== 'en') {
      await goH(p, '/settings')
      const btn = p.locator(`[data-testid="lang-${lang}"]`)
      if (await btn.count()) { await btn.click(); await p.waitForTimeout(500) } else { ok(`app: language button ${lang} found`, false); continue }
    }
    for (const r of routes) {
      await goH(p, r)
      const tx = await text(p); const m = tx.match(BAD)
      const buyBtns = await p.locator('[data-testid^="buy-"], [data-testid="ala-card"], [data-testid="unlock-single"], [data-testid="pack-buy"], [data-testid="unlock-upgrade"]').count()
      ok(`app(${label}) [${lang}] ${r}: no price/buy`, !m && buyBtns === 0, m ? `found "${m[0]}"` : buyBtns ? `buy elements=${buyBtns}` : '')
      if (lang === 'en' && label === '?src=twa') await p.screenshot({ path: `${OUT}/app-${lang}-${r.replace(/[^a-z0-9]+/gi, '_')}.png` })
    }
    // Knowledge locked HI/GU video tab → neutral message + neutral sheet
    await goH(p, '/knowledge/501'); await p.locator('[data-testid="k-lang-hi"]').click().catch(() => {}); await p.waitForTimeout(400)
    await p.locator('[role="tab"], button').filter({ hasText: /^(Videos|वीडियो|વીડિયો)/ }).first().click().catch(() => {}); await p.waitForTimeout(800)
    const locked = p.locator('[data-testid="k-lang-locked"]')
    if (await locked.count()) {
      const lt = await locked.innerText()
      ok(`app(${label}) [${lang}] Knowledge locked banner neutral`, !BAD.test(lt) && (await locked.locator('button').count()) === 0, lt.replace(/\n/g, ' '))
      const fl = p.locator('[data-testid="k-file-locked"] button').first()
      if (await fl.count()) {
        await fl.click(); await p.waitForTimeout(600)
        const sh = p.locator('[data-testid="unlock-sheet-app"]')
        ok(`app(${label}) [${lang}] locked item opens neutral sheet`, await sh.isVisible() && !BAD.test(await text(p)), await sh.innerText().catch(() => ''))
        if (lang === 'en' && label === '?src=twa') await p.screenshot({ path: `${OUT}/app-en-knowledge-locked-sheet.png` })
        await p.keyboard.press('Escape'); await p.waitForTimeout(300)
      }
    } else ok(`app(${label}) [${lang}] Knowledge HI tab locked banner present`, false, 'no k-lang-locked (maybe no HI videos in #501)')
  }
  // Membership status still shows current plan; trial start allowed
  await goH(p, '/membership')
  ok(`app(${label}): Membership shows current plan card`, await p.locator('[data-testid="mem-status"]').isVisible())
  ok(`app(${label}): trial card still present`, await p.locator('[data-testid="trial-card"]').isVisible())
  // persistence: reload without param in same tab session
  await p.goto(BASE + '#/membership'); await p.waitForTimeout(1500)
  ok(`app(${label}): still app mode after reload without param (sessionStorage)`, (await p.evaluate(() => document.documentElement.dataset.appStore)) === '1')
  ok(`app(${label}): Razorpay never requested`, rz.length === 0, rz.join(','))
  ok(`app(${label}): no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '))
  // new browser tab, same storage (Chrome tab on same phone): localStorage flag alone must NOT hide buying
  const p2 = await ctx.newPage(); await p2.goto(BASE + '#/membership'); await p2.waitForTimeout(1500)
  ok(`app(${label}): separate web tab (localStorage flag, not standalone) → web mode with buy`, (await p2.evaluate(() => document.documentElement.dataset.appStore)) === '0' && (await p2.locator('[data-testid^="buy-"]').count()) >= 3)
  await ctx.close()
}
// 3) APP via TWA referrer
{
  const { ctx, p } = await ctxPage()
  // Chromium ignores non-http referers in goto(); stub document.referrer exactly as the TWA launch sets it
  await p.addInitScript(() => Object.defineProperty(Document.prototype, 'referrer', { get: () => 'android-app://com.d31universe.pro/', configurable: true }))
  await p.goto(BASE + '#/home'); await p.waitForTimeout(1200)
  const ref = await p.evaluate(() => document.referrer)
  ok('referrer android-app://com.d31universe.pro → app mode', (await p.evaluate(() => document.documentElement.dataset.appStore)) === '1', `document.referrer="${ref}"`)
  await ctx.close()
}
// 4) web PWA standalone without flag → still web (emulate display-mode standalone)
{
  const { ctx, p } = await ctxPage()
  await p.addInitScript(() => { const o = window.matchMedia.bind(window); window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : o(q)) })
  await onboard(p, BASE + '#/home'); await goH(p, '/membership')
  ok('installed web PWA (standalone, no flag) → buying still shown', (await p.evaluate(() => document.documentElement.dataset.appStore)) === '0' && (await p.locator('[data-testid^="buy-"]').count()) >= 3)
  // TWA relaunch case: flag in localStorage + standalone + new session → app mode
  await p.evaluate(() => localStorage.setItem('d31-app-store-mode', '1'))
  const p3 = await ctx.newPage(); await p3.addInitScript(() => { const o = window.matchMedia.bind(window); window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : o(q)) })
  await p3.goto(BASE + '#/membership'); await p3.waitForTimeout(1500)
  ok('standalone + stored flag (TWA relaunch w/o param) → app mode', (await p3.evaluate(() => document.documentElement.dataset.appStore)) === '1' && (await p3.locator('[data-testid^="buy-"]').count()) === 0)
  await ctx.close()
}
fs.writeFileSync(`${OUT}/results.txt`, res.join('\n') + '\n')
console.log(`\n${res.filter((x) => x.startsWith('PASS')).length} pass / ${res.filter((x) => x.startsWith('FAIL')).length} fail`)
await b.close()
