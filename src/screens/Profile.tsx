import { useState } from 'react'
import { ChevronRight, Crown, LogIn, LogOut, Trash2, Settings as Cog, UserCog, Images, BookOpen, PlayCircle, Camera, Users, Ghost, Download, Lock, UserPlus } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Header, Label, Sheet } from '../components/ui'
import { Onboarding } from './Onboarding'
import { navigate, hashQuery } from '../lib/router'
import { env, isLive } from '../lib/env'
import { fmtDate } from '../lib/util'
import { Avatar, AvatarPicker } from '../components/Avatar'
import { deleteAccount, logOut, updateAccount, validEmail } from '../lib/accounts'
import { useCan } from '../lib/entitlements'
import { useUnits } from '../lib/units'

function Row({ icon, label, value, onClick, danger, testid }: { icon: React.ReactNode; label: string; value?: React.ReactNode; onClick?: () => void; danger?: boolean; testid?: string }) {
  return (
    <button data-testid={testid} onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] ${danger ? 'text-bad' : ''}`}>
      <span className={danger ? 'text-bad' : 'text-cyan/80'}>{icon}</span>
      <span className="flex-1 text-[14.5px]">{label}</span>
      {value}
      {onClick && !value && <ChevronRight size={17} className="text-dim" />}
    </button>
  )
}

export function Profile() {
  const t = useT()
  const s = useApp()
  const u = useUnits()
  const plan = effectivePlan(s.membership)
  const canDl = useCan('download.history')
  const [edit, setEdit] = useState(hashQuery().get('edit') === '1')
  const [acct, setAcct] = useState(false)
  const [del, setDel] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [nm, setNm] = useState(s.user?.name || s.profile.name)
  const [em, setEm] = useState(s.user?.email || '')
  const [err, setErr] = useState<string | null>(null)
  const name = s.user?.name || s.profile.name || t('athlete')
  const totalSets = s.sessions.reduce((n, x) => n + x.exercises.reduce((m, e) => m + e.sets.length, 0), 0)

  const socials = [
    { url: env.socials.youtube, icon: <PlayCircle size={18} />, label: 'YouTube' },
    { url: env.socials.instagram, icon: <Camera size={18} />, label: 'Instagram' },
    { url: env.socials.snapchat, icon: <Ghost size={18} />, label: 'Snapchat' },
    { url: env.socials.facebook, icon: <Users size={18} />, label: 'Facebook' },
  ].filter((x) => x.url)

  const saveAcct = () => {
    setErr(null)
    if (!nm.trim()) return setErr(t('errName'))
    if (s.user?.provider === 'local' && em.trim() !== s.user.email) {
      if (!validEmail(em)) return setErr(t('errEmail'))
      const r = updateAccount({ name: nm.trim(), email: em })
      if (!r.ok) return setErr(t(r.error === 'exists' ? 'errExists' : 'errEmail'))
    } else updateAccount({ name: nm.trim() })
    setAcct(false)
    s.showToast('✓')
  }
  const doDelete = async () => {
    const r = await deleteAccount()
    setDel(false)
    setConfirmText('')
    if (!r.ok) return s.showToast(r.error ?? 'Error')
    s.showToast(t('accountDeleted'))
    navigate('/')
  }

  return (
    <div>
      <Header title={t('navProfile')} right={<button data-testid="open-settings" aria-label={t('settings')} onClick={() => navigate('/settings')} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-muted hover:text-frost"><Cog size={18} /></button>} />

      <Card className="hud-full p-4">
        <div className="flex items-center gap-4">
          {s.user ? <AvatarPicker src={s.user.avatar} name={name} size={72} onChange={(a) => updateAccount({ avatar: a })} /> : <Avatar name={name} size={72} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[19px] font-extrabold" data-testid="profile-name">{name}</div>
            <div className="truncate text-[12.5px] text-muted">{s.user ? s.user.email : t('guestMode')}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={plan === 'platinum' ? 'violet' : plan === 'pro' ? 'cyan' : 'muted'}><Crown size={10} /> {t(`plan_${plan}`)}</Badge>
              <Badge tone="muted">{t(`goal_${s.profile.goal}`)}</Badge>
              <Badge tone="muted">{t(`level_${s.profile.level}`)}</Badge>
              {s.user?.provider === 'local' && <Badge tone="gold">{t('onDevice')}</Badge>}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/[0.07] py-2"><div className="readout text-[18px] font-bold">{s.sessions.length}</div><div className="text-[11px] text-muted">{t('workoutsLbl')}</div></div>
          <div className="rounded-xl border border-white/[0.07] py-2"><div className="readout text-[18px] font-bold">{totalSets}</div><div className="text-[11px] text-muted">{t('sets')}</div></div>
          <div className="rounded-xl border border-white/[0.07] py-2"><div className="readout text-[18px] font-bold">{s.profile.weightKg ? u.wTxt(s.profile.weightKg) : '—'}</div><div className="text-[11px] text-muted">{t('weight')}</div></div>
        </div>
        {!s.user && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button size="sm" data-testid="profile-signup" onClick={() => navigate('/auth?mode=signup&next=/profile')}><UserPlus size={15} /> {t('createAccount')}</Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/auth?next=/profile')}><LogIn size={15} /> {t('signIn')}</Button>
          </div>
        )}
      </Card>

      <Card className="mt-3 overflow-hidden" onClick={() => navigate('/membership')}>
        <div className="flex items-center gap-3 p-4" data-testid="plan-card">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/12 text-gold"><Crown size={19} /></span>
          <div className="flex-1">
            <Label>{t('currentPlan')}</Label>
            <div className={`mt-0.5 flex items-center gap-2 text-[16px] font-bold ${plan === 'platinum' ? 'text-platinum' : ''}`}>{t(`plan_${plan}`)} {s.membership.source === 'demo' && <Badge tone="gold">{t('demo')}</Badge>}</div>
            {plan !== 'free' && s.membership.until && <div className="text-[12px] text-muted">{t('validUntil', { d: fmtDate(s.membership.until, s.lang) })}</div>}
          </div>
          <span className="text-[13px] font-semibold text-cyan">{plan === 'free' ? t('upgrade') : t('manage')}</span>
        </div>
      </Card>

      <div className="label mb-2 mt-6">{t('account')}</div>
      <Card className="divide-y divide-white/[0.05] overflow-hidden">
        {s.user && <Row testid="edit-account" icon={<UserCog size={18} />} label={t('editAccount')} onClick={() => { setNm(s.user?.name || s.profile.name); setEm(s.user?.email || ''); setErr(null); setAcct(true) }} />}
        <Row icon={<UserCog size={18} />} label={t('editProfile')} onClick={() => setEdit(true)} />
        <Row testid="downloads" icon={<Download size={18} />} label={t('downloadsLbl')} value={canDl ? undefined : <span className="flex items-center gap-1 text-[12px] font-bold text-gold"><Lock size={13} /> {t('plan_platinum')}</span>} onClick={() => navigate(canDl ? '/progress?tab=history' : '/membership')} />
        <Row icon={<Cog size={18} />} label={t('settings')} onClick={() => navigate('/settings')} />
        <Row icon={<BookOpen size={18} />} label={t('knowledge')} onClick={() => navigate('/knowledge')} />
        <Row icon={<Images size={18} />} label={t('seeGallery')} onClick={() => navigate('/library?tab=shoot')} />
        {s.user && <Row testid="logout" icon={<LogOut size={18} />} label={t('signOut')} onClick={async () => { await logOut(); s.showToast(t('loggedOut')); navigate('/') }} />}
        <Row testid="delete-account" icon={<Trash2 size={18} />} label={s.user ? t('deleteAccount') : t('resetData')} onClick={() => { setConfirmText(''); setDel(true) }} danger />
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
      <p className="mt-8 text-center font-mono text-[11px] text-dim">D31.UNIVERSE {isLive ? '' : `· ${t('demo')}`}</p>

      <Sheet open={edit} onClose={() => setEdit(false)} title={t('editProfile')}>
        <Onboarding editing onDone={() => { setEdit(false); s.showToast('✓') }} />
      </Sheet>
      <Sheet open={acct} onClose={() => setAcct(false)} title={t('editAccount')}>
        <div className="space-y-3">
          <div className="flex justify-center"><AvatarPicker src={s.user?.avatar} name={nm} onChange={(a) => updateAccount({ avatar: a })} /></div>
          <label className="block"><span className="label">{t('obName')}</span><input data-testid="acct-name" className="field mt-1.5" value={nm} onChange={(e) => setNm(e.target.value)} /></label>
          <label className="block"><span className="label">{t('email')}</span><input className="field mt-1.5" type="email" value={em} disabled={s.user?.provider !== 'local'} onChange={(e) => setEm(e.target.value)} /></label>
          {err && <p className="text-[13px] text-gold">{err}</p>}
          <Button className="w-full" onClick={saveAcct} data-testid="acct-save">{t('save')}</Button>
          {s.user?.avatar && <Button variant="ghost" className="w-full" onClick={() => updateAccount({ avatar: undefined })}>{t('removePhoto')}</Button>}
        </div>
      </Sheet>
      <Sheet open={del} onClose={() => setDel(false)} title={s.user ? t('deleteAccount') : t('resetData')}>
        <p className="text-[14px] leading-relaxed">{s.user ? t('deleteQ') : t('resetQ')}</p>
        <p className="mt-3 text-[12.5px] text-muted">{t('typeDelete')}</p>
        <input data-testid="delete-confirm-input" className="field mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" autoCapitalize="characters" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={() => setDel(false)}>{t('cancel')}</Button>
          <Button variant="danger" data-testid="delete-confirm" disabled={confirmText.trim().toUpperCase() !== 'DELETE'} onClick={doDelete}><Trash2 size={15} /> {t('deleteLbl')}</Button>
        </div>
      </Sheet>
    </div>
  )
}
