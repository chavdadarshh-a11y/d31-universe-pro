/** localStorage keys for per-account data (no imports → no cycles). */
export const SESSION_KEY = 'd31-session'
export const GUEST_KEY = 'd31-pro-v1' // the guest keeps the original key, so v1–v3 data is never lost
export const ACCOUNTS_KEY = 'd31-accounts'
export const currentAccountId = (): string | null => {
  try { return localStorage.getItem(SESSION_KEY) || null } catch { return null }
}
export const dataKeyFor = (id: string | null) => (id ? `d31-data:${id}` : GUEST_KEY)
export const dataKey = () => dataKeyFor(currentAccountId())
