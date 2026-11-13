/**
 * Optional Google One Tap. Runs only when Supabase AND VITE_GOOGLE_CLIENT_ID are configured.
 * Google returns an ID token → Supabase signInWithIdToken (nonce protected).
 */
import { supabase } from './supabase'
import { env, isLive } from './env'

type GoogleId = { accounts: { id: { initialize: (o: Record<string, unknown>) => void; prompt: () => void; cancel: () => void } } }

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
}

let started = false
export async function startOneTap(onDone: (ok: boolean, err?: string) => void) {
  if (started || !isLive || !supabase || !env.googleClientId) return
  started = true
  await new Promise<void>((res, rej) => {
    if ((window as unknown as { google?: GoogleId }).google?.accounts) return res()
    const sc = document.createElement('script')
    sc.src = 'https://accounts.google.com/gsi/client'
    sc.async = true
    sc.onload = () => res()
    sc.onerror = () => rej(new Error('gsi'))
    document.head.appendChild(sc)
  }).catch(() => { started = false })
  const g = (window as unknown as { google?: GoogleId }).google
  if (!g) return
  const raw = crypto.randomUUID()
  const hashed = await sha256Hex(raw)
  g.accounts.id.initialize({
    client_id: env.googleClientId,
    nonce: hashed,
    use_fedcm_for_prompt: true,
    callback: async ({ credential }: { credential: string }) => {
      const { error } = await supabase!.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: raw })
      onDone(!error, error?.message)
    },
  })
  g.accounts.id.prompt()
}
