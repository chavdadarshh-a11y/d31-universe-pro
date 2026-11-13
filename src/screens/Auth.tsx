import { useState } from 'react'
import { Mail, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'
import { useT } from '../i18n'
import { Button, Header } from '../components/ui'
import { supabase } from '../lib/supabase'
import { isLive } from '../lib/env'
import { goBack, hashQuery, navigate } from '../lib/router'
import { useApp } from '../store/app'
import { LogoMark } from '../components/Brand'
import { logInLocal, logOut, signUpLocal, validEmail, type AuthError } from '../lib/accounts'

export function Auth() {
  const t = useT()
  const user = useApp((s) => s.user)
  const onboarded = useApp((s) => s.onboarded)
  const showToast = useApp((s) => s.showToast)
  const q = hashQuery()
  const [mode, setMode] = useState<'in' | 'up'>(q.get('mode') === 'signup' || q.get('mode') === 'up' ? 'up' : 'in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const next = q.get('next') || '/profile'
  const done = () => navigate(useApp.getState().onboarded ? next : '/')

  if (user) {
    return (
      <div>
        <Header title={t('authTitle')} back />
        <p className="text-sm text-muted">{t('signedInAs', { e: user.email })}</p>
        <Button className="mt-4 w-full" onClick={() => navigate(next)}>{t('continue')}</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={async () => { await logOut(); showToast(t('loggedOut')) }}>{t('signOut')}</Button>
      </div>
    )
  }

  const errText = (e: AuthError) => t(e === 'name' ? 'errName' : e === 'email' ? 'errEmail' : e === 'password' ? 'errPassword' : e === 'exists' ? 'errExists' : 'errLogin')

  const submit = async () => {
    setMsg(null)
    if (mode === 'up' && !name.trim()) return setMsg(t('errName'))
    if (!validEmail(email)) return setMsg(t('errEmail'))
    if (password.length < 6) return setMsg(t('errPassword'))
    setBusy(true)
    try {
      if (!isLive || !supabase) {
        const r = mode === 'up' ? await signUpLocal(name, email, password) : await logInLocal(email, password)
        if (!r.ok) return setMsg(errText(r.error))
        showToast(mode === 'up' ? t('welcomeName', { n: name.trim() }) : t('signedInAs', { e: email.trim().toLowerCase() }))
        return done()
      }
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        showToast(t('signedInAs', { e: email }))
        done()
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
        if (error) throw error
        if (data.session) done()
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

  const forgot = async () => {
    setMsg(null)
    if (!isLive || !supabase) return setMsg(t('localForgot'))
    if (!validEmail(email)) return setMsg(t('errEmail'))
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` })
    setMsg(error ? error.message : t('resetSent'))
  }

  return (
    <div>
      <Header title={t('authTitle')} back={onboarded} />
      <div className="mt-2 flex flex-col items-center text-center">
        <LogoMark size={64} />
        <h1 className="title-hud mt-4 text-[22px]">{mode === 'up' ? t('createAccount') : t('welcomeBack')}</h1>
        <p className="mt-1 max-w-[300px] text-[13px] text-muted">{t('signupSub')}</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 p-1">
        <button data-testid="tab-signup" onClick={() => { setMode('up'); setMsg(null) }} className={`h-10 rounded-xl text-[13.5px] font-bold ${mode === 'up' ? 'bg-neon-static text-[#05080f]' : 'text-muted'}`}>{t('createAccount')}</button>
        <button data-testid="tab-login" onClick={() => { setMode('in'); setMsg(null) }} className={`h-10 rounded-xl text-[13.5px] font-bold ${mode === 'in' ? 'bg-neon-static text-[#05080f]' : 'text-muted'}`}>{t('signIn')}</button>
      </div>
      <div className="mt-4 space-y-3">
        <Button variant="outline" className="w-full" onClick={google} disabled={!isLive}>
          <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          {t('google')}
        </Button>
        {!isLive && <p className="-mt-1 text-center text-[11.5px] text-dim">{t('googleAtLaunch')}</p>}
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-dim"><span className="h-px flex-1 bg-white/10" />{t('orEmail')}<span className="h-px flex-1 bg-white/10" /></div>
        {mode === 'up' && <label className="block"><span className="label">{t('obName')}</span><input data-testid="su-name" className="field mt-1.5" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label className="block"><span className="label">{t('email')}</span><input data-testid="su-email" className="field mt-1.5" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label className="block"><span className="label">{t('password')}</span>
          <span className="relative mt-1.5 block">
            <input data-testid="su-password" className="field pr-11" type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={t('min6')} />
            <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </span>
        </label>
        {msg && <p className="rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[13px] text-gold" role="alert">{msg}</p>}
        <Button className="w-full" size="lg" onClick={submit} disabled={busy} data-testid="auth-submit">
          {mode === 'in' ? <LogIn size={17} /> : <UserPlus size={17} />} {mode === 'in' ? t('signIn') : t('createAccount')}
        </Button>
        {mode === 'in' && <button className="w-full py-1 text-[13px] text-cyan" onClick={forgot}>{t('forgotPw')}</button>}
        {!isLive && <p className="flex items-start gap-2 rounded-xl border border-white/[0.07] px-3 py-2 text-[11.5px] leading-snug text-muted"><Mail size={13} className="mt-0.5 shrink-0" /> {t('localAccountNote')}</p>}
        <Button variant="ghost" className="w-full" onClick={() => (onboarded ? goBack('/home') : navigate('/?guest=1'))} data-testid="auth-guest">{t('guest')}</Button>
      </div>
    </div>
  )
}
