/**
 * ONE switch for every price and purchase surface in the app (web, installed PWA and the Play app).
 *  false (now): no ₹ amount, plan price, Buy / Upgrade / Unlock button, Portal Pass, FIRST 131 price line,
 *               wallet / referral amount or Razorpay anywhere — the app behaves like the Play-store build
 *               (src/lib/appMode.ts). Memberships people already have keep working.
 *  true:        prices and buying come back on the website (the Play app still never shows them).
 * A build can also override it: VITE_PRICES_ON=1 (on) or VITE_PRICES_ON=0 (off).
 */
const PRICES_ON_DEFAULT = false

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PRICES_ON
export const PRICES_ON: boolean = env === '1' ? true : env === '0' ? false : PRICES_ON_DEFAULT
