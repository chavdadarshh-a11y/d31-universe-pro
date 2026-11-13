import { supabase } from './supabase'
import { refreshMembership } from './cloud'
import { PASS_BY_ID, PAY_METHODS, type PassId, type UnlockSku } from '../config/plans'

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void }
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => res()
    s.onerror = () => rej(new Error('Could not load Razorpay. Check your connection.'))
    document.body.appendChild(s)
  })
}

export type Purchase = { sku: PassId } | { sku: UnlockSku; items: string[] }

/** UPI first, then cards, netbanking and wallets (order from pricing.json). */
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
  return p.sku === 'pack' ? 'Mini pack — 3 videos + 3 PDFs' : p.sku === 'video' ? 'Single video unlock' : 'Single PDF unlock'
}
/** Server creates the order (amount decided server-side from pricing.json), browser opens checkout, server verifies signature.
 *  Every purchase is a one-time payment — passes never auto-renew. */
export async function payWithRazorpay(purchase: Purchase, prefill: { email?: string; name?: string }): Promise<'paid' | 'dismissed'> {
  if (!supabase) throw new Error('Payments need Supabase configured')
  const { data, error } = await supabase.functions.invoke('razorpay-create-order', { body: purchase })
  if (error) throw new Error(error.message)
  const order = data as { orderId: string; amount: number; currency: string; keyId: string; error?: string }
  if (order.error) throw new Error(order.error)
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
        await refreshMembership()
        if (!(purchase.sku in PASS_BY_ID)) { const { useUnlocks } = await import('./unlocks'); await useUnlocks.getState().refresh() }
        resolve('paid')
      },
    })
    rz.on('payment.failed', () => resolve('dismissed'))
    rz.open()
  })
}
