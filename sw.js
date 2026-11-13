/* D31.UNIVERSE service worker — app-shell caching so the app opens offline. */
const VERSION = 'd31-v3.3.0'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
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
  // video clips are streamed with Range requests; let the browser handle them
  if (url.pathname.includes('/media/clips/') || /\.(mp4|webm)$/.test(url.pathname)) return
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
