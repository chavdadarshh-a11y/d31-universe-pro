/** localStorage keys for per-account data (no imports → no cycles). */
export const SESSION_KEY = 'd31-session'
export const GUEST_KEY = 'd31-pro-v1' // the guest keeps the original key, so v1–v3 data is never lost
export const ACCOUNTS_KEY = 'd31-accounts'
export const currentAccountId = (): string | null => {
  try { return localStorage.getItem(SESSION_KEY) || null } catch { return null }
}
export const dataKeyFor = (id: string | null) => (id ? `d31-data:${id}` : GUEST_KEY)
export const dataKey = () => dataKeyFor(currentAccountId())

/* "Remember me" off → the session lasts only until the app/browser is closed.
 * Runs when this module first loads (before the store rehydrates). */
export const REMEMBER_KEY = 'd31-remember'
export const SESSION_ENDED = { local: false }
try {
  if (localStorage.getItem(REMEMBER_KEY) === '0' && !sessionStorage.getItem('d31-alive')) {
    if (localStorage.getItem(SESSION_KEY)) SESSION_ENDED.local = true
    localStorage.removeItem(SESSION_KEY)
  }
  sessionStorage.setItem('d31-alive', '1')
} catch { /* storage blocked */ }
export function setRemember(on: boolean) {
  try { localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'); sessionStorage.setItem('d31-alive', '1') } catch { /* ignore */ }
}
