/**
 * Beta flags for what every visitor can VIEW vs DOWNLOAD.
 *
 * VIEW_ALL_OPEN — browse, read and watch every library exercise and every Knowledge
 *   post that has real files. Posts with no files stay "Coming soon".
 *   When false, the older rules apply: only LIBRARY_OPEN categories and OPEN_POSTS.
 *   This conflicts with the earlier "only Calisthenics / only 3 posts" request
 *   (t103u / t104u). Flip to false to go back to that.
 *
 * DOWNLOAD_LOCK — PDF, video/media and export downloads stay behind a membership
 *   tier (see entitlements.ts). Own-data JSON backup stays free.
 *
 * Prices stay hidden (PRICES_ON_DEFAULT in prices.ts). Do not turn prices on here.
 */
const envOn = (name: string, fallback: boolean) => {
  const v = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name]
  return v === '1' ? true : v === '0' ? false : fallback
}

export const VIEW_ALL_OPEN = envOn('VITE_VIEW_ALL_OPEN', true)
export const DOWNLOAD_LOCK = envOn('VITE_DOWNLOAD_LOCK', true)

/** Emails that can open the hidden owner stats screen and call the owner RPC. */
const envEmails = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_OWNER_EMAILS
export const OWNER_EMAILS: string[] = (envEmails || 'dpchavda22@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

/** Optional GoatCounter site URL, e.g. https://d31.goatcounter.com/count — only if Darshan signed up. */
export const GOATCOUNTER = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GOATCOUNTER || '').trim()
