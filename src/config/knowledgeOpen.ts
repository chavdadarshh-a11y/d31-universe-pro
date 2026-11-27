/**
 * Knowledge (Learn) posts that are OPEN right now — the ONE place to change the older 3-post rule.
 * Open posts show (per language en / hi / gu) at most VIDEOS videos and PDFS PDFs, plus PHOTOS photos — only Darshan's
 * real files from the Drive feed, copies ("name (1).pdf") skipped, never invented. A language with fewer real files
 * simply shows fewer. Every other post shows its cover with "Coming soon" and no content.
 * Order here = order in the cascade (open posts come first).
 *
 * When VIEW_ALL_OPEN is true (src/config/access.ts), every post that has real files is viewable; OPEN_POSTS
 * is only used as the featured order, and OPEN_LIMITS is not applied. Posts with no files stay "Coming soon".
 * Flip VIEW_ALL_OPEN to false to restore this 3-post rule.
 */
export const OPEN_POSTS: number[] = [503, 504, 507]
export const OPEN_LIMITS = { videos: 3, pdfs: 3, photos: 3 } as const
