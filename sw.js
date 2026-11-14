/* D31.UNIVERSE service worker — app-shell caching so the app opens offline. */
const VERSION = 'd31-v4.1.3-play'
const OFFLINE = 'd31-offline-clips' // Platinum "save offline" clips — never deleted on update
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== OFFLINE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
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
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res }).catch(() => caches.match('./index.html')))
    return
  }
  // hashed build assets: cache-first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) }
    return res
  })))
})
