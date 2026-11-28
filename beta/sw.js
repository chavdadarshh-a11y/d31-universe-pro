/* D31.UNIVERSE service worker — app-shell caching so the app opens offline. */
const VERSION = 'd31-beta-v4.5.0-14bd23f'
const OFFLINE = 'd31-offline-clips' // Platinum "save offline" clips — never deleted on update
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './media/bg/shiva-v2-1440.avif', './media/bg/shiva-v2-2160.avif', './media/bg/shiva-v2-1440.webp', './media/bg/shiva-v2-2160.webp']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  // only this channel's old caches are removed: live ('d31-v…'), beta ('d31-beta-…') and preview ('d31-preview-…') share the origin
  const chan = (k) => (k.startsWith('d31-beta-') ? 'beta' : k.startsWith('d31-preview-') ? 'preview' : 'live')
  const mine = (k) => chan(k) === chan(VERSION)
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => mine(k) && k !== VERSION && k !== OFFLINE && !k.endsWith('-reminder') && k !== 'd31-reminder').map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // never cache API calls (Supabase, Razorpay, Gemini) or the camera model
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes('fonts.g')) {
      e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res })))
    }
    return
  }
  // video clips stream from the network; clips saved offline (Platinum) are served from the phone when offline
  if (url.pathname.includes('/media/clips/') || /\.(mp4|webm)$/.test(url.pathname)) {
    e.respondWith(fetch(req).catch(() => caches.open(OFFLINE).then((c) => c.match(url.pathname, { ignoreSearch: true }).then((hit) => hit || c.match(req.url)).then((hit) => hit || Response.error()))))
    return
  }
  // Knowledge feed: always try fresh, fall back to the last copy
  if (url.pathname.endsWith('/knowledge/posts.json')) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); return res }).catch(() => caches.match(url.pathname)))
    return
  }
  if (req.mode === 'navigate') {
    // revalidate the HTML with the server every time (no 10-minute HTTP cache), so a new release shows on refresh
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res }).catch(() => caches.match('./index.html')))
    return
  }
  // hashed build assets: cache-first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) }
    return res
  })))
})

// ── Daily reminder (max once a day; the page writes the settings into Cache Storage) ──
// Installed PWA on Chrome Android: Periodic Background Sync wakes this worker about every few hours
// (the browser decides). The page and this worker share the "last shown" day, so it never notifies twice.
const REM = VERSION.startsWith('d31-beta-') ? 'd31-beta-reminder' : VERSION.startsWith('d31-preview-') ? 'd31-preview-reminder' : 'd31-reminder'
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
async function checkReminder() {
  const c = await caches.open(REM)
  const url = new URL('__d31_reminder.json', self.registration.scope).href
  const hit = await c.match(url)
  if (!hit) return
  const cfg = await hit.json()
  if (!cfg.enabled || !Array.isArray(cfg.days)) return
  const now = new Date()
  if (!cfg.days.includes(now.getDay())) return
  const [h, m] = String(cfg.time || '18:00').split(':').map(Number)
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
  const today = dayKey(now)
  if (cfg.last === today || cfg.done === today) return
  cfg.last = today
  await c.put(url, new Response(JSON.stringify(cfg), { headers: { 'content-type': 'application/json' } }))
  await self.registration.showNotification(cfg.title || 'D31.UNIVERSE', { body: cfg.body || '', icon: cfg.icon, badge: cfg.icon, tag: 'd31-reminder', data: { url: cfg.url } })
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'd31-reminder') e.waitUntil(checkReminder()) })
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || './#/home', self.registration.scope).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const w of list) if (w.url.startsWith(self.registration.scope) && 'focus' in w) { if (w.navigate) w.navigate(url).catch(() => {}); return w.focus() }
    return self.clients.openWindow(url)
  }))
})
