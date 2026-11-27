// Static checks for plan flags, view-all, download lock, analytics and waitlist.
import fs from 'node:fs'
let failed = 0
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) failed++ }
const rd = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

ok(/VIEW_ALL_OPEN = envOn\('VITE_VIEW_ALL_OPEN', true\)/.test(rd('src/config/access.ts')), 'VIEW_ALL_OPEN defaults true')
ok(/DOWNLOAD_LOCK = envOn\('VITE_DOWNLOAD_LOCK', true\)/.test(rd('src/config/access.ts')), 'DOWNLOAD_LOCK defaults true')
ok(/PRICES_ON_DEFAULT = false/.test(rd('src/config/prices.ts')), 'prices stay hidden')
ok(rd('src/config/library.ts').includes('VIEW_ALL_OPEN') && rd('src/config/library.ts').includes("LIBRARY_OPEN: Category[] = ['calisthenics']"), 'library keeps calisthenics list and respects VIEW_ALL_OPEN')
ok(rd('src/lib/knowledge.ts').includes('isViewablePost') && rd('src/lib/knowledge.ts').includes('VIEW_ALL_OPEN'), 'knowledge curate respects VIEW_ALL_OPEN')
ok(rd('src/lib/entitlements.ts').includes('if (!DOWNLOAD_LOCK') && rd('src/lib/entitlements.ts').includes("knowledgeDownloadOk"), 'downloads respect DOWNLOAD_LOCK; backup stays free')
ok(rd('src/screens/Membership.tsx').includes('WaitlistTiers') && rd('src/screens/Membership.tsx').includes('joinWaitlist'), 'membership waitlist tiers exist')
ok(!/₹/.test(rd('src/screens/Membership.tsx').split('function WaitlistTiers')[1].split('export function Membership')[0]), 'waitlist cards have no rupee amounts')
ok(rd('src/screens/Knowledge.tsx').includes('isViewablePost') && rd('src/screens/Knowledge.tsx').includes('k-dl-locked'), 'knowledge: view-all + download lock button')
ok(rd('src/components/DownloadButton.tsx').includes('FEATURE_PLAN') && rd('src/components/DownloadButton.tsx').includes('Lock'), 'export buttons show the locking tier')
ok(rd('src/screens/Stats.tsx').includes('owner-stats') && rd('src/App.tsx').includes("case 'stats'"), 'hidden /stats route exists')
ok(rd('src/lib/owner.ts').includes('dpchavda22@gmail.com') || rd('src/config/access.ts').includes('dpchavda22@gmail.com'), 'owner email gate')
ok(rd('src/lib/analytics.ts').includes('page_views') && rd('src/lib/analytics.ts').includes('visitorId'), 'page-view logger with anonymous visitor id')
ok(rd('public/privacy.html').includes('Site use (analytics)') && rd('public/privacy.html').includes('lang="hi"') && rd('public/privacy.html').includes('lang="gu"'), 'privacy.html discloses analytics in en/hi/gu')
ok(rd('src/screens/Legal.tsx').includes('Site use (analytics)'), 'in-app privacy policy discloses analytics')
ok(fs.existsSync(new URL('../supabase/migrations/0010_page_views_waitlist_owner_stats.sql', import.meta.url)), 'SQL migration is in supabase/migrations')
ok(rd('supabase/migrations/0010_page_views_waitlist_owner_stats.sql').includes('owner_site_stats') && rd('supabase/migrations/0010_page_views_waitlist_owner_stats.sql').includes('for insert to anon'), 'migration is insert-only with owner RPC')
ok(!/lifetime|for life/i.test(rd('src/screens/Membership.tsx') + rd('src/config/plans.ts') + rd('src/i18n/strings51.ts')), 'FIRST 131 is not called lifetime')
ok(rd('src/i18n/strings51.ts').includes('joinWaitlist:') && rd('src/i18n/strings51.ts').includes('hi51') && rd('src/i18n/strings51.ts').includes('gu51'), 'new strings in en/hi/gu')

console.log(failed ? `\n${failed} failed` : '\nAll access / plans checks passed')
process.exit(failed ? 1 : 0)
