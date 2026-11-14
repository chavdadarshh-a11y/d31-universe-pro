import { supabase } from './supabase'
import { refreshMembership } from './cloud'
import { PASS_BY_ID, PAY_METHODS, POST_PASS_BY_ID, isPostPassId, type PassId, type PostPassId, type UnlockSku } from '../config/plans'
import { IN_APP } from './appMode'
import { useWallet } from './wallet'
import { track } from './analytics'
import { postPassDuration } from '../config/plans'

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void }
  }
}

function loadScript(): Promise<void> {
  if (IN_APP) return Promise.reject(new Error('Not available in the app'))
  if (window.Razorpay) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => res()
    s.onerror = () => rej(new Error('Could not load Razorpay. Check your connection.'))
    document.body.appendChild(s)
  })
}

export type Purchase = ({ sku: PassId } | { sku: UnlockSku; items: string[] } | { sku: PostPassId; posts: number[] }) & { wallet?: boolean }

const LABEL: Record<string, string> = { upi: 'UPI', card: 'Cards', netbanking: 'Netbanking', wallet: 'Wallets' }
function checkoutConfig() {
  const [first, ...rest] = PAY_METHODS
  return {
    display: {
      blocks: {
        first: { name: `Pay using ${LABEL[first]}`, instruments: [{ method: first }] },
        rest: { name: rest.map((m) => LABEL[m]).join(', '), instruments: rest.map((m) => ({ method: m })) },
      },
      sequence: ['block.first', 'block.rest'],
      preferences: { show_default_blocks: false },
    },
  }
}
const describe = (p: Purchase) => {
  if (p.sku in PASS_BY_ID) { const x = PASS_BY_ID[p.sku as PassId]; return `${x.plan.toUpperCase()} — ${x.days} days (one-time, no auto-renew)` }
  if (isPostPassId(p.sku)) {
    const x = POST_PASS_BY_ID[p.sku]
    const d = postPassDuration(x)
    return `${x.name} — ${x.posts} credit${x.posts === 1 ? '' : 's'}, ${d.n} ${d.unit} each (credits never expire)`
  }
  return p.sku === 'pack' ? 'Mini pack — 3 videos + 3 PDFs' : p.sku === 'video' ? 'Single video unlock' : 'Single PDF unlock'
}

async function afterPaid(purchase: Purchase) {
  await refreshMembership()
  await useWallet.getState().refresh()
  if (isPostPassId(purchase.sku)) {
    const { usePostPasses } = await import('./postPasses')
    await usePostPasses.getState().refresh()
    void track('pass_sale', { sku: purchase.sku })
    void track('first_purchase', { sku: purchase.sku }, { once: true })
  } else if (purchase.sku in PASS_BY_ID) {
    void track('membership_sale', { sku: purchase.sku })
    void track('first_purchase', { sku: purchase.sku }, { once: true })
  }
}

/** Server creates the order (amount decided server-side from pricing.json), browser opens checkout, server verifies signature.
 *  Every purchase is a one-time payment — passes never auto-renew. */
export async function payWithRazorpay(purchase: Purchase, prefill: { email?: string; name?: string }): Promise<'paid' | 'dismissed'> {
  if (IN_APP) throw new Error('Not available in the app')
  if (!supabase) throw new Error('Payments need Supabase configured')
  const body = 'posts' in purchase
    ? { sku: purchase.sku, items: purchase.posts, wallet: !!purchase.wallet }
    : 'items' in purchase
      ? { sku: purchase.sku, items: purchase.items, wallet: !!purchase.wallet }
      : { sku: purchase.sku, wallet: !!purchase.wallet }
  const { data, error } = await supabase.functions.invoke('razorpay-create-order', { body })
  if (error) throw new Error(error.message)
  const order = data as { orderId: string; amount: number; currency: string; keyId: string; error?: string; paidWithWallet?: boolean }
  if (order.error) throw new Error(order.error)

  if (order.paidWithWallet || order.amount === 0) {
    const v = await supabase.functions.invoke('razorpay-verify', { body: { razorpay_order_id: order.orderId, orderId: order.orderId } })
    if (v.error || (v.data as { error?: string })?.error) throw new Error(v.error?.message ?? (v.data as { error: string }).error)
    await afterPaid(purchase)
    return 'paid'
  }

  await loadScript()
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'D31.UNIVERSE',
      description: describe(purchase),
      prefill,
      method: { upi: true, card: true, netbanking: true, wallet: true },
      config: checkoutConfig(),
      theme: { color: '#22d3ee' },
      modal: { ondismiss: () => resolve('dismissed') },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const v = await supabase!.functions.invoke('razorpay-verify', { body: resp })
        if (v.error || (v.data as { error?: string })?.error) {
          reject(new Error(v.error?.message ?? (v.data as { error: string }).error))
          return
        }
        await afterPaid(purchase)
        resolve('paid')
      },
    })
    rz.on('payment.failed', () => resolve('dismissed'))
    rz.open()
  })
}
