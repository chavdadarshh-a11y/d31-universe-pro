/**
 * Where the site lives — filled at build time from site.config.json (`siteUrl`, the ONE value to change for a
 * custom domain; see README → "Custom domain"). Use these instead of hard-coding the GitHub Pages address.
 */
declare const __D31_SITE__: { siteUrl: string; appUrl: string; sitePath: string }
const S = typeof __D31_SITE__ !== 'undefined' ? __D31_SITE__ : { siteUrl: '/', appUrl: '/', sitePath: '/' }
/** the public site, e.g. https://chavdadarshh-a11y.github.io/d31-universe-pro/ */
export const SITE_URL = S.siteUrl
/** this build's own absolute URL (live = SITE_URL; beta / preview = their sub-folder) */
export const APP_URL = S.appUrl
/** path of the public site ("/d31-universe-pro/" on GitHub Pages, "/" on a custom domain) — knowledge feed lives here */
export const SITE_PATH = S.sitePath
