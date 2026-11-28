/** THE one post order used everywhere (Today cascade, Library, Knowledge, search, passes, next/prev):
 *  strictly ascending by post number — #501, #502, #503 … Posts without a valid number go last (by title).
 *  Pure (no imports) so unit tests load it directly. */
type P = { number?: unknown; title?: unknown }
const postNum = (p: P) => { const n = Number(p.number); return Number.isFinite(n) && n > 0 ? n : Infinity }
export const comparePosts = (a: P, b: P) => { const x = postNum(a), y = postNum(b); return x !== y ? (x < y ? -1 : 1) : String(a.title ?? '').localeCompare(String(b.title ?? '')) }
export const sortPosts = <T extends P>(ps: T[]) => [...ps].sort(comparePosts)
/** previous / next post in that same order (null at the ends — no wrap-around) */
export const neighbours = <T extends P>(ps: T[], number: number) => { const s = sortPosts(ps); const i = s.findIndex((p) => p.number === number); return { prev: i > 0 ? s[i - 1] : null, next: i >= 0 && i < s.length - 1 ? s[i + 1] : null } }
