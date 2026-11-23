/**
 * Beta builds (VITE_BETA=1, served from /d31-universe-pro/beta/) share the origin with the live app.
 * Keep the live app's saved data safe: every 'd31-…' key the beta writes goes to its own 'd31beta:' copy.
 * Reads fall back to the live value (read-only) until the beta has its own, so the beta opens with the
 * user's data but never changes the live copy.
 */
export const IS_BETA = Boolean(import.meta.env.VITE_BETA)
if (IS_BETA && typeof Storage !== 'undefined') {
  const P = 'd31beta:', GONE = '\u0000deleted'
  const proto = Storage.prototype
  const get = proto.getItem, set = proto.setItem, del = proto.removeItem
  const mine = (k: unknown): k is string => typeof k === 'string' && k.startsWith('d31-')
  proto.getItem = function (k: string) {
    if (!mine(k)) return get.call(this, k)
    const v = get.call(this, P + k)
    return v === GONE ? null : v !== null ? v : get.call(this, k)
  }
  proto.setItem = function (k: string, v: string) { return set.call(this, mine(k) ? P + k : k, v) }
  proto.removeItem = function (k: string) { return mine(k) ? set.call(this, P + k, GONE) : del.call(this, k) }
}
