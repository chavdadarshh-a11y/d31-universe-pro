/**
 * Preview builds (VITE_PREVIEW=1, served from /d31-universe-pro/preview/) share the origin with the live app.
 * Keep the live app's saved data safe: every 'd31-…' key the preview writes goes to its own 'd31preview:' copy.
 * Reads fall back to the live value (read-only) until the preview has its own, so the preview opens with the
 * user's data but never changes the live copy.
 */
export const IS_PREVIEW = Boolean(import.meta.env.VITE_PREVIEW)
if (IS_PREVIEW && typeof Storage !== 'undefined') {
  const P = 'd31preview:', GONE = '\u0000deleted'
  const proto = Storage.prototype
  const get = proto.getItem, set = proto.setItem
  const mine = (k: unknown): k is string => typeof k === 'string' && k.startsWith('d31-')
  proto.getItem = function (k: string) {
    if (!mine(k)) return get.call(this, k)
    const v = get.call(this, P + k)
    return v === GONE ? null : v !== null ? v : get.call(this, k)
  }
  proto.setItem = function (k: string, v: string) { return set.call(this, mine(k) ? P + k : k, v) }
  const del = proto.removeItem
  proto.removeItem = function (k: string) { return mine(k) ? set.call(this, P + k, GONE) : del.call(this, k) }
}

/**
 * The live app's service worker (scope /d31-universe-pro/) also sees the first visit to /preview/ and stores
 * that page as ITS offline index.html. Repair it from the preview: any live cache whose index.html is a preview
 * page gets the real live page back (or the entry is dropped, so the live worker simply uses the network).
 */
if (IS_PREVIEW && typeof window !== 'undefined' && 'caches' in window) {
  const base = import.meta.env.BASE_URL // …/preview/ (or /beta/ style sub-channel)
  const liveBase = base.replace(/[^/]+\/$/, '')
  const liveIndex = new URL(liveBase + 'index.html', location.origin).href
  const repair = async () => {
    try {
      for (const k of await caches.keys()) {
        if (k.startsWith('d31-preview-') || k === 'd31-offline-clips' || !k.startsWith('d31-')) continue
        const c = await caches.open(k)
        const hit = await c.match(liveIndex)
        if (!hit) continue
        const txt = await hit.clone().text()
        if (!txt.includes(base + 'assets/')) continue
        try {
          const fresh = await fetch(liveIndex, { cache: 'no-store' })
          const body = await fresh.clone().text()
          if (fresh.ok && !body.includes(base + 'assets/')) await c.put(liveIndex, fresh)
          else await c.delete(liveIndex)
        } catch { await c.delete(liveIndex) }
      }
    } catch { /* storage unavailable — nothing to repair */ }
  }
  window.addEventListener('load', () => { void repair(); setTimeout(() => void repair(), 8000) })
}
