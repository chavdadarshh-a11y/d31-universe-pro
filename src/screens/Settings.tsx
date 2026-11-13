import { useRef, useState } from 'react'
import { Moon, Sun, MonitorSmartphone, Languages, Ruler, Timer, Volume2, Vibrate, Bell, Film, Shield, Download, Upload, Info, Mail, FileText, AlertTriangle, Receipt, Smartphone, Mic } from 'lucide-react'
import { useApp } from '../store/app'
import { useSettings, resolvedTheme } from '../store/settings'
import { useT, LANGS } from '../i18n'
import { Button, Card, Header, Stepper } from '../components/ui'
import { navigate } from '../lib/router'
import { APP_VERSION, env, isLive } from '../lib/env'
import { exportBackup, importBackup } from '../lib/backup'
import { askNotificationPermission, notify } from '../lib/reminders'
import { useInstallable, promptInstall } from '../components/InstallPrompt'
import { cloud } from '../lib/cloud'
import { Switch } from '../components/Switch'

/** All on/off switches use the v4.1 pill switch. */
export function Toggle({ on, onChange, label, testid }: { on: boolean; onChange: (v: boolean) => void; label: string; testid?: string }) {
  return <Switch on={on} onChange={onChange} label={label} testid={testid} />
}

function Row({ icon, label, sub, right, onClick, danger }: { icon: React.ReactNode; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span className={danger ? 'text-bad' : 'text-cyan/80'}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14.5px] ${danger ? 'text-bad' : ''}`}>{label}</span>
        {sub && <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{sub}</span>}
      </span>
      {right}
    </>
  )
  return onClick
    ? <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02]">{inner}</button>
    : <div className="flex w-full items-center gap-3 px-4 py-3">{inner}</div>
}

function Seg<T extends string>({ value, items, onChange, testid }: { value: T; items: { id: T; label: React.ReactNode }[]; onChange: (v: T) => void; testid?: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-white/10 p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((it) => (
        <button key={it.id} data-testid={testid ? `${testid}-${it.id}` : undefined} onClick={() => onChange(it.id)} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-bold ${value === it.id ? 'bg-neon-static text-[#05080f]' : 'text-muted'}`}>{it.label}</button>
      ))}
    </div>
  )
}

const DAYS = [1, 2, 3, 4, 5, 6, 0]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="label mb-2 mt-6">{title}</div>
      <Card className="divide-y divide-white/[0.05] overflow-hidden">{children}</Card>
    </>
  )
}

export function Settings() {
  const t = useT()
  const s = useApp()
  const st = useSettings()
  const dark = resolvedTheme(st.theme) === 'night'
  const file = useRef<HTMLInputElement>(null)
  const installable = useInstallable()
  const [perm, setPerm] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  const dayName = (d: number) => new Date(2026, 10, 1 + d).toLocaleDateString(s.lang === 'en' ? 'en-IN' : s.lang === 'hi' ? 'hi-IN' : 'gu-IN', { weekday: 'narrow' })
  const setReminder = (p: Partial<typeof st.reminder>) => st.set({ reminder: { ...st.reminder, ...p } })
  const toggleReminder = async (on: boolean) => {
    if (on) {
      const p = await askNotificationPermission()
      setPerm(p)
      if (p !== 'granted') return s.showToast(t('notifDenied'))
    }
    setReminder({ enabled: on })
  }

  return (
    <div>
      <Header title={t('settings')} back="#/profile" />

      <Section title={t('appearance')}>
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="text-muted">{dark ? <Moon size={18} /> : <Sun size={18} />}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px]">{t('theme')}</div>
            <div className="mt-0.5 text-[12px] text-muted">{dark ? t('themeNight') : t('themeLight')}{st.theme === 'system' ? ` · ${t('themeSystem')}` : ''}</div>
          </div>
          <Switch variant="sky" size="lg" testid="theme-switch" label={`${t('themeNight')} / ${t('themeLight')}`} on={!dark} onChange={(v) => st.set({ theme: v ? 'light' : 'night' })} />
        </div>
        <Row icon={<MonitorSmartphone size={18} />} label={t('themeSystem')} right={<Toggle testid="theme-system" label={t('themeSystem')} on={st.theme === 'system'} onChange={(v) => st.set({ theme: v ? 'system' : resolvedTheme('system') })} />} />
        <Row icon={<Film size={18} />} label={t('bgVideo')} sub={t('bgVideoSub')} right={<Toggle testid="bg-toggle" label={t('bgVideo')} on={st.bgVideo} onChange={(v) => st.set({ bgVideo: v })} />} />
        <Row icon={<Smartphone size={18} />} label={t('dataSaver')} sub={t('dataSaverSub')} right={<Toggle testid="datasaver-toggle" label={t('dataSaver')} on={st.reduceData} onChange={(v) => st.set({ reduceData: v })} />} />
      </Section>

      <Section title={`${t('language')} · ${t('units')}`}>
        <div className="px-4 py-3.5">
          <div className="mb-2.5 flex items-center gap-2 text-[14.5px]"><Languages size={16} className="text-cyan/80" /> {t('language')}</div>
          <Seg testid="lang" value={s.lang} onChange={(v) => { s.setLang(v); void cloud.profile() }} items={LANGS.map((l) => ({ id: l.id, label: l.native }))} />
        </div>
        <div className="px-4 py-3.5">
          <div className="mb-2.5 flex items-center gap-2 text-[14.5px]"><Ruler size={16} className="text-cyan/80" /> {t('weightUnit')}</div>
          <Seg testid="wunit" value={st.weightUnit} onChange={(v) => st.set({ weightUnit: v })} items={[{ id: 'kg', label: 'kg' }, { id: 'lb', label: 'lb' }]} />
        </div>
        <div className="px-4 py-3.5">
          <div className="mb-2.5 flex items-center gap-2 text-[14.5px]"><Ruler size={16} className="text-cyan/80" /> {t('lengthUnit')}</div>
          <Seg testid="lunit" value={st.lengthUnit} onChange={(v) => st.set({ lengthUnit: v })} items={[{ id: 'cm', label: 'cm' }, { id: 'in', label: 'in' }]} />
        </div>
      </Section>

      <Section title={t('workoutSettings')}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-cyan/80"><Timer size={18} /></span>
          <span className="flex-1 text-[14.5px]">{t('defaultRest')}</span>
          <div className="w-36"><Stepper value={s.restDefault} step={15} min={15} max={300} suffix="s" onChange={(v) => s.set({ restDefault: v })} /></div>
        </div>
        <Row icon={<Volume2 size={18} />} label={t('soundLbl')} sub={t('soundSub')} right={<Toggle testid="sound-toggle" label={t('soundLbl')} on={st.sound} onChange={(v) => st.set({ sound: v })} />} />
        <Row icon={<Vibrate size={18} />} label={t('vibrationLbl')} right={<Toggle testid="vib-toggle" label={t('vibrationLbl')} on={st.vibration} onChange={(v) => st.set({ vibration: v })} />} />
        <Row icon={<Mic size={18} />} label={t('voiceCues')} right={<Toggle label={t('voiceCues')} on={s.voice} onChange={(v) => s.set({ voice: v })} />} />
      </Section>

      <Section title={t('reminders')}>
        <Row icon={<Bell size={18} />} label={t('workoutReminder')} sub={perm === 'denied' ? t('notifDenied') : t('reminderSub')} right={<Toggle testid="reminder-toggle" label={t('workoutReminder')} on={st.reminder.enabled} onChange={(v) => void toggleReminder(v)} />} />
        {st.reminder.enabled && (
          <div className="space-y-3 px-4 py-3.5">
            <label className="flex items-center gap-3"><span className="flex-1 text-[14px]">{t('timeLbl')}</span><input type="time" className="field w-32" value={st.reminder.time} onChange={(e) => setReminder({ time: e.target.value })} /></label>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => {
                const on = st.reminder.days.includes(d)
                return <button key={d} onClick={() => setReminder({ days: on ? st.reminder.days.filter((x) => x !== d) : [...st.reminder.days, d] })} className={`h-9 rounded-lg border text-[12.5px] font-bold ${on ? 'border-cyan/60 bg-cyan/12 text-cyan' : 'border-white/10 text-muted'}`}>{dayName(d)}</button>
              })}
            </div>
            <Button size="sm" variant="ghost" onClick={() => void notify('D31.UNIVERSE', t('testNotifBody'))}>{t('testNotif')}</Button>
          </div>
        )}
      </Section>

      <Section title={t('privacyData')}>
        <Row icon={<Shield size={18} />} label={t('whereData')} sub={isLive && s.user ? t('whereDataLive') : t('whereDataLocal')} />
        <Row icon={<Download size={18} />} label={t('exportData')} sub={t('exportSub')} onClick={() => { exportBackup(); s.showToast('✓') }} />
        <Row icon={<Upload size={18} />} label={t('restoreData')} sub={t('restoreSub')} onClick={() => file.current?.click()} />
        <input ref={file} type="file" accept="application/json,.json" className="hidden" data-testid="restore-input" onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const r = await importBackup(f)
          s.showToast(r.ok ? t('restoreOk', { n: r.sessions ?? 0 }) : `${t('restoreFail')} ${r.error ?? ''}`)
        }} />
      </Section>

      <Section title={t('aboutLbl')}>
        <Row icon={<Info size={18} />} label="D31.UNIVERSE" sub={`${t('version')} ${APP_VERSION}${isLive ? '' : ` · ${t('demo')}`}`} />
        <Row icon={<Smartphone size={18} />} label={t('installApp')} sub={installable ? undefined : t('installHint')} onClick={installable ? () => void promptInstall() : undefined} />
        <Row icon={<Shield size={18} />} label={t('privacy')} onClick={() => navigate('/legal/privacy')} />
        <Row icon={<FileText size={18} />} label={t('terms')} onClick={() => navigate('/legal/terms')} />
        <Row icon={<AlertTriangle size={18} />} label={t('disclaimer')} onClick={() => navigate('/legal/disclaimer')} />
        <Row icon={<Receipt size={18} />} label={t('refunds')} onClick={() => navigate('/legal/refunds')} />
        <Row icon={<Mail size={18} />} label={t('contactSupport')} sub={env.supportEmail || t('supportPending')} onClick={env.supportEmail ? () => { window.location.href = `mailto:${env.supportEmail}?subject=D31.UNIVERSE%20support` } : () => navigate('/legal/contact')} />
      </Section>
      <p className="mt-8 text-center font-mono text-[11px] text-dim">D31.UNIVERSE · v{APP_VERSION}</p>
    </div>
  )
}
