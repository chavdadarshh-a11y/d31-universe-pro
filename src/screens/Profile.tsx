import { useState } from 'react'
import { ChevronRight, Crown, Download, LogIn, LogOut, RotateCcw, Shield, FileText, AlertTriangle, Receipt, Mail, Volume2, Timer, UserCog, PlayCircle, Camera, Users, Ghost } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT, LANGS } from '../i18n'
import { Badge, Card, Confirm, Header, Label, Sheet, Stepper } from '../components/ui'
import { Onboarding } from './Onboarding'
import { navigate, hashQuery } from '../lib/router'
import { supabase } from '../lib/supabase'
import { APP_VERSION, env, isLive } from '../lib/env'
import { download, fmtDate } from '../lib/util'
import { cloud } from '../lib/cloud'

function Row({ icon, label, value, onClick, danger }: { icon: React.ReactNode; label: string; value?: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] ${danger ? 'text-bad' : ''}`}>
      <span className={danger ? 'text-bad' : 'text-muted'}>{icon}</span>
      <span className="flex-1 text-[14.5px]">{label}</span>
      {value}
      {onClick && !value && <ChevronRight size={17} className="text-dim" />}
    </button>
  )
}

export function Profile() {
  const t = useT()
  const s = useApp()
  const plan = effectivePlan(s.membership)
  const [edit, setEdit] = useState(hashQuery().get('edit') === '1')
  const [reset, setReset] = useState(false)
  const initials = (s.profile.name || s.user?.email || 'D31').slice(0, 2).toUpperCase()

  const signOut = async () => {
    await supabase?.auth.signOut()
    s.set({ user: null, membership: { plan: 'free', source: 'none' } })
  }
  const exportData = () => {
    const { sessions, measurements, foods, checkins, customWorkouts, analyses, profile, water } = useApp.getState()
    download(`d31-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ profile, sessions, measurements, foods, water, checkins, customWorkouts, analyses: analyses.map(({ thumb: _t, ...a }) => a) }, null, 2))
  }
  const socials = [
    { url: env.socials.youtube, icon: <PlayCircle size={18} />, label: 'YouTube' },
    { url: env.socials.instagram, icon: <Camera size={18} />, label: 'Instagram' },
    { url: env.socials.snapchat, icon: <Ghost size={18} />, label: 'Snapchat' },
    { url: env.socials.facebook, icon: <Users size={18} />, label: 'Facebook' },
  ].filter((x) => x.url)

  return (
    <div>
      <Header title={t('navProfile')} />
      <Card className="flex items-center gap-4 p-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-panel-2 font-mono text-lg font-bold text-gold">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-bold">{s.profile.name || 'Athlete'}</div>
          <div className="truncate text-[12.5px] text-muted">{s.user ? s.user.email : t('guestMode')} · {t(`goal_${s.profile.goal}`)}</div>
        </div>
        {!s.user && <button onClick={() => navigate('/auth?next=/profile')} className="flex h-9 items-center gap-1.5 rounded-xl bg-cyan px-3 text-[13px] font-semibold text-black"><LogIn size={15} /> {t('signIn')}</button>}
      </Card>

      <Card className="mt-3 overflow-hidden" onClick={() => navigate('/membership')}>
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/12 text-gold"><Crown size={19} /></span>
          <div className="flex-1">
            <Label>{t('currentPlan')}</Label>
            <div className="mt-0.5 flex items-center gap-2 text-[16px] font-bold">{t(`plan_${plan}`)} {s.membership.source === 'demo' && <Badge tone="gold">{t('demo')}</Badge>}</div>
            {plan !== 'free' && s.membership.until && <div className="text-[12px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}</div>}
          </div>
          <span className="text-[13px] font-semibold text-cyan">{plan === 'free' ? t('upgrade') : t('manage')}</span>
        </div>
      </Card>

      <div className="label mb-2 mt-6">{t('settings')}</div>
      <Card className="divide-y divide-white/[0.05] overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="mb-2.5 text-[14.5px]">{t('language')}</div>
          <div className="grid grid-cols-3 gap-2">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => { s.setLang(l.id); void cloud.profile() }} className={`h-10 rounded-xl border text-[14px] font-semibold ${s.lang === l.id ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/10 text-muted'}`}>{l.native}</button>
            ))}
          </div>
        </div>
        <Row icon={<Volume2 size={18} />} label={t('voiceCues')} onClick={() => s.set({ voice: !s.voice })} value={
          <span className={`relative h-6 w-11 rounded-full transition-colors ${s.voice ? 'bg-cyan' : 'bg-white/15'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${s.voice ? 'left-[22px]' : 'left-0.5'}`} /></span>
        } />
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-muted"><Timer size={18} /></span>
          <span className="flex-1 text-[14.5px]">{t('defaultRest')}</span>
          <div className="w-36"><Stepper value={s.restDefault} step={15} min={15} max={300} suffix="s" onChange={(v) => s.set({ restDefault: v })} /></div>
        </div>
        <Row icon={<UserCog size={18} />} label={t('editProfile')} onClick={() => setEdit(true)} />
        <Row icon={<Download size={18} />} label={t('exportData')} onClick={exportData} />
        <Row icon={<RotateCcw size={18} />} label={t('resetData')} onClick={() => setReset(true)} danger />
        {s.user && <Row icon={<LogOut size={18} />} label={t('signOut')} onClick={signOut} />}
      </Card>

      <div className="label mb-2 mt-6">{t('legal')}</div>
      <Card className="divide-y divide-white/[0.05] overflow-hidden">
        <Row icon={<Shield size={18} />} label={t('privacy')} onClick={() => navigate('/legal/privacy')} />
        <Row icon={<FileText size={18} />} label={t('terms')} onClick={() => navigate('/legal/terms')} />
        <Row icon={<AlertTriangle size={18} />} label={t('disclaimer')} onClick={() => navigate('/legal/disclaimer')} />
        <Row icon={<Receipt size={18} />} label={t('refunds')} onClick={() => navigate('/legal/refunds')} />
        <Row icon={<Mail size={18} />} label={t('contact')} onClick={() => navigate('/legal/contact')} />
      </Card>

      {socials.length > 0 && (
        <>
          <div className="label mb-2 mt-6">{t('follow')}</div>
          <div className="grid grid-cols-4 gap-2">
            {socials.map((x) => (
              <a key={x.label} href={x.url} target="_blank" rel="noreferrer" className="card flex flex-col items-center gap-1.5 py-3 text-muted hover:text-frost">{x.icon}<span className="text-[11px]">{x.label}</span></a>
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-center font-mono text-[11px] text-dim">D31.UNIVERSE · {t('version')} {APP_VERSION} {isLive ? '' : `· ${t('demo')}`}</p>

      <Sheet open={edit} onClose={() => setEdit(false)} title={t('editProfile')}>
        <Onboarding editing onDone={() => { setEdit(false); s.showToast('✓') }} />
      </Sheet>
      <Confirm open={reset} text={t('resetQ')} confirmLabel={t('resetData')} cancelLabel={t('cancel')} danger onClose={() => setReset(false)} onConfirm={() => s.resetAll()} />
    </div>
  )
}
