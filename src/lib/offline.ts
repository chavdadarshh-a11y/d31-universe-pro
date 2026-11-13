/** Offline clips (Platinum): Cache Storage; the service worker serves them when offline. */
export const OFFLINE_CACHE = 'd31-offline-clips'
export async function saveClipOffline(urls: string[]) {
  const c = await caches.open(OFFLINE_CACHE)
  await c.addAll(urls)
}
export async function isClipSaved(url: string) {
  if (!('caches' in window)) return false
  const c = await caches.open(OFFLINE_CACHE)
  return !!(await c.match(url))
}
export async function removeClipOffline(urls: string[]) {
  const c = await caches.open(OFFLINE_CACHE)
  await Promise.all(urls.map((u) => c.delete(u)))
}
