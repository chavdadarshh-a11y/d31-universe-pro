import { useState } from 'react'
import { Mail, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'
import type React from 'react'
import { useT } from '../i18n'
import { Button, Header } from '../components/ui'
import { supabase } from '../lib/supabase'
import { isLive } from '../lib/env'
import { goBack, hashQuery, navigate } from '../lib/router'
import { useApp } from '../store/app'
import { LogoMark } from '../components/Brand'
import { logInLocal, logOut, signUpLocal, validEmail, type AuthError } from '../lib/accounts'
import { REMEMBER_KEY, setRemember as setRememberPref } from '../lib/accountKeys'
import { startOneTap } from '../lib/googleOneTap'
import { useEffect } from 'react'

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
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) !== '0')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const next = q.get('next') || '/profile'
  // optional Google One Tap (only when Supabase + a Google client id are configured)
  useEffect(() => { if (!user) void startOneTap((ok, err) => { if (ok) navigate(useApp.getState().onboarded ? next : '/'); else if (err) setMsg(err) }) }, [user, next])
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

  /** Let Chrome / Android's password manager offer "Save password" (Credential Management API). */
  const storeCred = async () => {
    try {
      const PC = (window as unknown as { PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential }).PasswordCredential
      if (PC && navigator.credentials?.store) await navigator.credentials.store(new PC({ id: email.trim().toLowerCase(), password, name: name.trim() || undefined }))
    } catch { /* not supported */ }
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setMsg(null)
    setRememberPref(remember)
    if (mode === 'up' && !name.trim()) return setMsg(t('errName'))
    if (!validEmail(email)) return setMsg(t('errEmail'))
    if (password.length < 6) return setMsg(t('errPassword'))
    setBusy(true)
    try {
      if (!isLive || !supabase) {
        const r = mode === 'up' ? await signUpLocal(name, email, password) : await logInLocal(email, password)
        if (!r.ok) return setMsg(errText(r.error))
        showToast(mode === 'up' ? t('welcomeName', { n: name.trim() }) : t('signedInAs', { e: email.trim().toLowerCase() }))
        await storeCred()
        return done()
      }
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        showToast(t('signedInAs', { e: email }))
        await storeCred()
        done()
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
        if (error) throw error
        if (data.session) { await storeCred(); done() }
        else setMsg(t('checkEmail'))
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setRememberPref(remember)
    if (!isLive || !supabase) return setMsg(t('googleLaunchNote'))
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
      <form className="mt-4 space-y-3" method="post" action="#" autoComplete="on" onSubmit={submit} noValidate data-testid="auth-form">
        <GoogleButton onClick={google} label={t('googleContinue')} />
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-dim"><span className="h-px flex-1 bg-white/10" />{t('orEmail')}<span className="h-px flex-1 bg-white/10" /></div>
        {mode === 'up' && <label className="block" htmlFor="d31-name"><span className="label">{t('obName')}</span><input id="d31-name" name="name" data-testid="su-name" className="field mt-1.5" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label className="block" htmlFor="d31-email"><span className="label">{t('email')}</span><input id="d31-email" name="email" data-testid="su-email" className="field mt-1.5" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label className="block" htmlFor="d31-password"><span className="label">{t('password')}</span>
          <span className="relative mt-1.5 block">
            <input id="d31-password" name="password" data-testid="su-password" className="field pr-11" type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('min6')} />
            <button type="button" aria-label={show ? t('hidePw') : t('showPw')} aria-pressed={show} data-testid="pw-eye" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px]" htmlFor="d31-remember">
          <input id="d31-remember" name="remember" type="checkbox" data-testid="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[18px] w-[18px] accent-[#22d3ee]" />
          {t('rememberMe')}
        </label>
        {msg && <p className="rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[13px] text-gold" role="alert">{msg}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={busy} data-testid="auth-submit">
          {mode === 'in' ? <LogIn size={17} /> : <UserPlus size={17} />} {mode === 'in' ? t('signIn') : t('createAccount')}
        </Button>
        {mode === 'in' && <button type="button" className="w-full py-1 text-[13px] text-cyan" onClick={forgot}>{t('forgotPw')}</button>}
        {!isLive && <p className="flex items-start gap-2 rounded-xl border border-white/[0.07] px-3 py-2 text-[11.5px] leading-snug text-muted"><Mail size={13} className="mt-0.5 shrink-0" /> {t('localAccountNote')}</p>}
        <Button type="button" variant="ghost" className="w-full" onClick={() => (onboarded ? goBack('/home') : navigate('/?guest=1'))} data-testid="auth-guest">{t('guest')}</Button>
      </form>
    </div>
  )
}

/** Google's own "Continue with Google" button (branding guidelines: official G logo, Roboto Medium, neutral fill, pill). */
function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} data-testid="google-btn" className="gsi-btn">
      <span className="gsi-logo" aria-hidden>
        <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      </span>
      <span className="gsi-text">{label}</span>
    </button>
  )
}
