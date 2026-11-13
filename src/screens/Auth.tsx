import { useState } from 'react'
import { Mail, LogIn } from 'lucide-react'
import { useT } from '../i18n'
import { Button, Header } from '../components/ui'
import { supabase } from '../lib/supabase'
import { isLive } from '../lib/env'
import { goBack, hashQuery, navigate } from '../lib/router'
import { useApp } from '../store/app'
import { LogoMark } from '../components/Brand'

export function Auth() {
  const t = useT()
  const user = useApp((s) => s.user)
  const showToast = useApp((s) => s.showToast)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const next = hashQuery().get('next') || '/profile'

  if (user) {
    return (
      <div>
        <Header title={t('authTitle')} back />
        <p className="text-sm text-muted">{t('signedInAs', { e: user.email })}</p>
        <Button className="mt-4 w-full" onClick={() => navigate(next)}>{t('continue')}</Button>
      </div>
    )
  }

  const submit = async () => {
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        showToast(t('signedInAs', { e: email }))
        navigate(next)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
        if (error) throw error
        if (data.session) navigate(next)
        else setMsg(t('checkEmail'))
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` } })
    if (error) setMsg(error.message)
  }

  return (
    <div>
      <Header title="" back />
      <div className="flex flex-col items-center text-center">
        <LogoMark size={56} />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t('authTitle')}</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">{t('authSub')}</p>
      </div>

      {!isLive && <div className="mt-6 rounded-2xl border border-gold/25 bg-gold/[0.07] p-4 text-sm text-gold">{t('authDemo')}</div>}

      <div className="mt-6 space-y-3">
        <Button variant="outline" className="w-full" onClick={google} disabled={!isLive}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          {t('google')}
        </Button>
        <div className="flex items-center gap-3 text-[11px] text-dim"><span className="h-px flex-1 bg-white/10" />OR<span className="h-px flex-1 bg-white/10" /></div>
        <label className="block"><span className="label">{t('email')}</span><input className="field mt-1.5" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isLive} /></label>
        <label className="block"><span className="label">{t('password')}</span><input className="field mt-1.5" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} disabled={!isLive} onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>
        {msg && <p className="text-sm text-gold">{msg}</p>}
        <Button className="w-full" onClick={submit} disabled={!isLive || busy || !email || password.length < 6}>
          {mode === 'in' ? <LogIn size={17} /> : <Mail size={17} />} {mode === 'in' ? t('signIn') : t('signUp')}
        </Button>
        <button className="w-full py-2 text-sm text-cyan disabled:opacity-40" disabled={!isLive} onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? t('noAccount') : t('haveAccount')}
        </button>
        <Button variant="ghost" className="w-full" onClick={() => goBack('/home')}>{t('guest')}</Button>
      </div>
    </div>
  )
}
