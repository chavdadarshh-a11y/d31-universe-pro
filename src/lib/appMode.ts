/**
 * App-store mode (Google Play TWA). Inside the Android app all buying UI is hidden (Play payments
 * policy): no prices, no Buy/Upgrade/Unlock buttons, no Razorpay. Memberships bought on the website
 * still work after sign-in. The website (browser tab or installed web PWA) is unchanged.
 *
 * Detection, evaluated once at startup:
 *  1. document.referrer starts with android-app://com.d31universe.pro (TWA launch), or
 *  2. ?src=twa / ?utm_source=twa in the URL (TWA start_url carries it; also accepted in the hash query)
 *  → sets sessionStorage + localStorage flags.
 *  3. sessionStorage flag (same app session, e.g. after a reload).
 *  4. localStorage flag AND display-mode standalone. Chrome tabs share localStorage with the TWA,
 *     so the flag alone would hide buying on the website in Chrome; requiring standalone keeps the
 *     web tab normal. display-mode standalone alone is NOT used (installed web PWA keeps buying).
 *  ?src=web clears the flags (support/debug).
 */
export const TWA_PACKAGE = 'com.d31universe.pro'
const KEY = 'd31-app-store-mode'

function param(name: string): string | null {
  try {
    const s = new URLSearchParams(window.location.search).get(name)
    if (s) return s
    const h = window.location.hash
    const i = h.indexOf('?')
    return i >= 0 ? new URLSearchParams(h.slice(i + 1)).get(name) : null
  } catch { return null }
}

function detect(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const src = (param('src') || param('utm_source') || '').toLowerCase()
    if (src === 'web') {
      sessionStorage.removeItem(KEY); localStorage.removeItem(KEY)
      return false
    }
    const ref = document.referrer || ''
    if (ref.startsWith(`android-app://${TWA_PACKAGE}`) || src === 'twa') {
      sessionStorage.setItem(KEY, '1'); localStorage.setItem(KEY, '1')
      return true
    }
    if (sessionStorage.getItem(KEY) === '1') return true
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
    if (localStorage.getItem(KEY) === '1' && standalone) { sessionStorage.setItem(KEY, '1'); return true }
  } catch { /* storage blocked → web mode */ }
  return false
}

/** true inside the Google Play app: hide every price / purchase surface. */
export const IN_APP = detect()
if (typeof document !== 'undefined') document.documentElement.dataset.appStore = IN_APP ? '1' : '0'
