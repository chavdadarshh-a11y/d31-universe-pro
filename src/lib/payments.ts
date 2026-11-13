import { supabase } from './supabase'
import { refreshMembership } from './cloud'
import type { PlanId } from '../types'

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

/** Server creates the order (amount decided server-side), browser opens checkout, server verifies signature. */
export async function payWithRazorpay(plan: Exclude<PlanId, 'free'>, prefill: { email?: string; name?: string }): Promise<'paid' | 'dismissed'> {
  if (!supabase) throw new Error('Payments need Supabase configured')
  const { data, error } = await supabase.functions.invoke('razorpay-create-order', { body: { plan } })
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
      description: `${plan.toUpperCase()} — 1 month`,
      prefill,
      theme: { color: '#22d3ee' },
      modal: { ondismiss: () => resolve('dismissed') },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const v = await supabase!.functions.invoke('razorpay-verify', { body: resp })
        if (v.error || (v.data as { error?: string })?.error) {
          reject(new Error(v.error?.message ?? (v.data as { error: string }).error))
          return
        }
        await refreshMembership()
        resolve('paid')
      },
    })
    rz.on('payment.failed', () => resolve('dismissed'))
    rz.open()
  })
}
