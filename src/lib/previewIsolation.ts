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
