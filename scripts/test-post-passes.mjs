import { chromium } from '/workspace/build/pw/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:8942/d31-universe-pro/'
const OUT = process.argv[3] || '/workspace/d31-shots-passes'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const res = []; const ok = (n, c, x = '') => { res.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`); console.log(res.at(-1)) }
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
async function ctxPage() {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: 'block' })
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
  return { ctx, p, errs }
}
async function onboard(p, url) {
  await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
  const tid = (id) => p.locator(`[data-testid="${id}"]`)
  if (await tid('ob-guest').isVisible().catch(() => false)) { await tid('ob-guest').click(); await p.waitForTimeout(300) }
  for (let i = 0; i < 6 && await tid('ob-next').isVisible().catch(() => false); i++) { await tid('ob-next').click(); await p.waitForTimeout(300) }
}
const text = (p) => p.evaluate(() => document.body.innerText)
const goH = async (p, h) => { await p.evaluate((h) => { location.hash = h }, h); await p.waitForTimeout(1400) }

async function openLockedSheet(p) {
  await goH(p, '/knowledge/501')
  await p.locator('[data-testid="k-lang-hi"]').click().catch(() => {})
  await p.waitForTimeout(500)
  await p.locator('[role="tab"], button').filter({ hasText: /^(Videos|वीडियो|વીડિયો)/ }).first().click().catch(() => {})
  await p.waitForTimeout(800)
  const openThis = p.locator('[data-testid="pp-open-this"]')
  if (await openThis.count()) { await openThis.click(); await p.waitForTimeout(500); return true }
  const fl = p.locator('[data-testid="k-file-locked"] button').first()
  if (await fl.count()) { await fl.click(); await p.waitForTimeout(500); return true }
  return false
}

// 1) Free user — passes on plans + locked post
{
  const { ctx, p, errs } = await ctxPage()
  await onboard(p, BASE + '#/home')
  await goH(p, '/membership')
  const section = p.locator('[data-testid="pp-section"]')
  ok('free: Post passes on Plans', await section.isVisible())
  const tx = await text(p)
  ok('free: prices ₹21 / ₹31 / ₹331', /₹\s*21\b/.test(tx) && /₹\s*31\b/.test(tx) && /₹\s*331\b/.test(tx), tx.includes('Post passes') ? '' : 'section text missing')
  ok('free: all 3 buy buttons', await p.locator('[data-testid="buy-post_1"]').count() === 1 && await p.locator('[data-testid="buy-post_3"]').count() === 1 && await p.locator('[data-testid="buy-post_30"]').count() === 1)
  ok('free: view-only / no-download note', /view and stream only|downloads stay with platinum/i.test(tx))
  await p.locator('[data-testid="pp-section"]').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${OUT}/01-free-plans-post-passes.png` })

  const opened = await openLockedSheet(p)
  ok('free: locked post opens pass options', opened && await p.locator('[data-testid="post-passes"]').isVisible())
  const st = await text(p)
  ok('free: locked sheet has ₹21 / ₹31 / ₹331', /₹\s*21\b/.test(st) && /₹\s*31\b/.test(st) && /₹\s*331\b/.test(st))
  await p.screenshot({ path: `${OUT}/02-free-locked-post-sheet.png` })
  ok('free: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
  await ctx.close()
}

// 2) Pro and Gold still see passes; Platinum does not
{
  const { ctx, p } = await ctxPage()
  await onboard(p, BASE + '#/home')
  await goH(p, '/membership')
  await p.locator('[data-testid="demo-pro"]').click(); await p.waitForTimeout(400)
  await goH(p, '/membership')
  ok('pro: Post passes still shown', await p.locator('[data-testid="pp-section"]').isVisible())
  await p.locator('[data-testid="pp-section"]').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${OUT}/03-pro-plans-post-passes.png` })

  await p.locator('[data-testid="demo-gold"]').click(); await p.waitForTimeout(400)
  await goH(p, '/membership')
  ok('gold: Post passes still shown', await p.locator('[data-testid="pp-section"]').isVisible())
  const gtx = await text(p)
  ok('gold: prices ₹21 / ₹31 / ₹331', /₹\s*21\b/.test(gtx) && /₹\s*31\b/.test(gtx) && /₹\s*331\b/.test(gtx))
  await p.locator('[data-testid="pp-section"]').scrollIntoViewIfNeeded()
  await p.screenshot({ path: `${OUT}/04-gold-plans-post-passes.png` })

  await p.locator('[data-testid="demo-platinum"]').click(); await p.waitForTimeout(400)
  await goH(p, '/membership')
  ok('platinum: Post passes hidden', await p.locator('[data-testid="pp-section"]').count() === 0 && await p.locator('[data-testid="buy-post_1"]').count() === 0)
  const ptx = await text(p)
  // membership still has other ₹ prices (tier cards); the post-pass SKUs must not appear
  ok('platinum: no ₹21 / ₹31 / ₹331', !/₹\s*21\b/.test(ptx) && !/₹\s*31\b/.test(ptx) && !/₹\s*331\b/.test(ptx), /₹\s*21|₹\s*31|₹\s*331/.exec(ptx)?.[0] ?? '')
  await p.screenshot({ path: `${OUT}/05-platinum-plans-no-passes.png` })
  await ctx.close()
}

// 3) Demo purchase of a 1-post pass unlocks that post and shows a countdown
{
  const { ctx, p, errs } = await ctxPage()
  await onboard(p, BASE + '#/home')
  const opened = await openLockedSheet(p)
  ok('demo buy: sheet opened', opened)
  await p.locator('[data-testid="buy-post_1"]').click()
  await p.waitForTimeout(1000)
  // sheet should close; banner + unlocked files
  await p.locator('[data-testid="k-lang-hi"]').click().catch(() => {})
  await p.waitForTimeout(300)
  await p.locator('[role="tab"], button').filter({ hasText: /^(Videos|वीडियो|વીડિયો)/ }).first().click().catch(() => {})
  await p.waitForTimeout(800)
  const banner = p.locator('[data-testid="pp-banner"]')
  ok('demo buy: countdown banner on post', await banner.isVisible())
  const bt = await banner.innerText()
  ok('demo buy: banner has remaining time', /\d+\s*h|\d+\s*m/.test(bt) && /left|बाकी|બાકી/i.test(bt), bt.replace(/\n/g, ' '))
  ok('demo buy: Hindi videos unlocked (not locked rows)', await p.locator('[data-testid="k-file-locked"]').count() === 0 && await p.locator('[data-testid="k-file"]').count() >= 1)
  ok('demo buy: view-only note visible', /view and stream only|downloads stay with platinum/i.test(await text(p)))
  // downloads still locked (not Platinum)
  ok('demo buy: download still Platinum-only', await p.locator('[data-testid="k-dl-locked"]').count() >= 1)
  await p.screenshot({ path: `${OUT}/06-demo-buy-1post-unlocked.png` })
  // plans page shows the active pass + countdown
  await goH(p, '/membership')
  await p.locator('[data-testid="pp-section"]').scrollIntoViewIfNeeded().catch(() => {})
  ok('demo buy: plans show active pass countdown', await p.locator('[data-testid="pp-active"]').isVisible() && await p.locator('[data-testid="pp-countdown"]').count() >= 1)
  await p.screenshot({ path: `${OUT}/07-demo-buy-plans-countdown.png` })
  ok('demo buy: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))
  await ctx.close()
}

// 4) App mode — nothing of this, no ₹21/₹31/₹331
{
  const { ctx, p } = await ctxPage()
  await onboard(p, BASE + '?src=twa#/home')
  ok('app: flag on', (await p.evaluate(() => document.documentElement.dataset.appStore)) === '1')
  for (const r of ['/membership', '/knowledge', '/knowledge/501', '/legal/terms', '/legal/refunds']) {
    await goH(p, r)
    const tx = await text(p)
    const hit = /₹\s*21\b|₹\s*31\b|₹\s*331\b/.test(tx)
    const els = await p.locator('[data-testid="pp-section"], [data-testid="post-passes"], [data-testid="buy-post_1"], [data-testid="buy-post_3"], [data-testid="buy-post_30"]').count()
    ok(`app ${r}: no post-pass prices or buy UI`, !hit && els === 0, hit ? 'found ₹21/31/331' : els ? `elements=${els}` : '')
  }
  await goH(p, '/membership')
  await p.screenshot({ path: `${OUT}/08-app-membership-no-prices.png` })
  await goH(p, '/knowledge/501')
  await p.locator('[data-testid="k-lang-hi"]').click().catch(() => {})
  await p.waitForTimeout(400)
  await p.locator('[role="tab"], button').filter({ hasText: /^(Videos|वीडियो|વીડિયો)/ }).first().click().catch(() => {})
  await p.waitForTimeout(800)
  const fl = p.locator('[data-testid="k-file-locked"] button').first()
  if (await fl.count()) { await fl.click(); await p.waitForTimeout(500) }
  const sh = p.locator('[data-testid="unlock-sheet-app"]')
  ok('app: locked item still opens neutral sheet', await sh.isVisible() && !/₹\s*21|₹\s*31|₹\s*331/.test(await text(p)))
  await p.screenshot({ path: `${OUT}/09-app-locked-sheet-neutral.png` })
  await ctx.close()
}

fs.writeFileSync(`${OUT}/results.txt`, res.join('\n') + '\n')
const pass = res.filter((x) => x.startsWith('PASS')).length
const fail = res.filter((x) => x.startsWith('FAIL')).length
console.log(`\n${pass} pass / ${fail} fail`)
await b.close()
process.exit(fail ? 1 : 0)
