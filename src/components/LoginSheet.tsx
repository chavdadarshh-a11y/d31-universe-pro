import { useState } from 'react'
import { Mail, ShieldCheck } from 'lucide-react'
import { Sheet, Button } from './ui'
import { useT } from '../i18n'
import { useLoginAsk } from '../lib/loginAsk'
import { env, isLive } from '../lib/env'
import { supabase } from '../lib/supabase'
import { validEmail } from '../lib/accounts'
import { useApp } from '../store/app'

const redirect = () => `${window.location.origin}${import.meta.env.BASE_URL}`

/** Soft, dismissible "save your progress" sheet. With Supabase off (beta today) it says "coming soon" and the guest carries on. */
export function LoginSheet() {
  const t = useT()
  const { reason, close } = useLoginAsk()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useApp((s) => s.showToast)
  if (!reason) return null
  const done = () => { setMsg(null); setEmail(''); close() }

  const google = async () => {
    if (!env.googleAuth || !supabase) { toast(t('googleSoon')); return }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } })
    setBusy(false)
    if (error) setMsg(error.message)
  }
  const link = async () => {
    if (!supabase) return
    if (!validEmail(email)) return setMsg(t('errEmail'))
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect(), shouldCreateUser: true } })
    setBusy(false)
    setMsg(error ? error.message : t('lsLinkSent'))
  }

  return (
    <Sheet open onClose={done} title={t(`lsTitle_${reason}`)}>
      <div data-testid="login-sheet" className="pb-1">
        <p className="flex items-start gap-2 text-[13.5px] leading-snug text-frost/85"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan" /> {t('lsBody')}</p>
        {isLive && supabase ? (
          <div className="mt-4 space-y-3">
            <button type="button" onClick={() => void google()} disabled={busy} data-testid="ls-google" className="gsi-btn">
              <span className="gsi-logo" aria-hidden><svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg></span>
              <span className="gsi-text">{t('googleContinue')}</span>
            </button>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-dim"><span className="h-px flex-1 bg-white/10" />{t('orEmail')}<span className="h-px flex-1 bg-white/10" /></div>
            <input data-testid="ls-email" className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t('lsEmailPh')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="w-full" variant="outline" disabled={busy} onClick={() => void link()} data-testid="ls-link"><Mail size={16} /> {t('lsSendLink')}</Button>
            <p className="text-center text-[11.5px] text-dim">{t('lsNoPassword')}</p>
            {msg && <p role="status" className="rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[13px] text-gold">{msg}</p>}
            <Button variant="ghost" className="w-full" onClick={done} data-testid="login-later">{t('lsLater')}</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3" data-testid="login-soon">
            <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-3">
              <span className="rounded-md bg-gold px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-black">{t('lsSoonBadge')}</span>
              <p className="mt-2 text-[13px] leading-snug text-frost/85">{t('lsSoonBody')}</p>
            </div>
            <Button className="w-full" onClick={done} data-testid="login-later">{t('lsOk')}</Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
