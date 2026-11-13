import { useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { useApp } from '../store/app'
import { useT, LANGS } from '../i18n'
import { Button, Stepper } from '../components/ui'
import { LogoMark, Wordmark } from '../components/Brand'
import { navigate } from '../lib/router'
import type { Equipment, Goal, Level, Profile } from '../types'
import { PROGRAMS } from '../data/programs'
import { cloud } from '../lib/cloud'

const GOALS: Goal[] = ['muscle', 'fatloss', 'strength', 'skills', 'mobility']
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']
const EQUIP: Equipment[] = ['none', 'dumbbell', 'barbell', 'bar', 'bench', 'band', 'kettlebell']
const ACT: Profile['activity'][] = [1.2, 1.375, 1.55, 1.725]

function Option({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${active ? 'border-cyan/60 bg-cyan/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {sub && <span className="mt-0.5 block text-[13px] text-muted">{sub}</span>}
      </span>
      <span className={`grid h-6 w-6 place-items-center rounded-full border ${active ? 'border-cyan bg-cyan text-[#041016]' : 'border-white/20'}`}>{active && <Check size={14} strokeWidth={3} />}</span>
    </button>
  )
}

export function pickProgram(goal: Goal, equipment: Equipment[]): string {
  if (goal === 'mobility') return 'mobility-15'
  if (goal === 'fatloss') return 'home-burn'
  const hasGym = equipment.includes('barbell') || equipment.includes('dumbbell')
  return hasGym && goal === 'strength' ? 'strength-5x5' : 'foundation'
}

export function Onboarding({ editing = false, onDone }: { editing?: boolean; onDone?: () => void }) {
  const t = useT()
  const { lang, setLang, profile, setProfile, completeOnboarding, set } = useApp()
  const [step, setStep] = useState(editing ? 1 : 0)
  const total = 5

  const finish = () => {
    if (!editing) {
      const id = pickProgram(profile.goal, profile.equipment)
      if (PROGRAMS.some((p) => p.id === id)) set({ activeProgramId: id })
      completeOnboarding()
      navigate('/home')
    }
    void cloud.profile()
    onDone?.()
  }

  const toggleEq = (e: Equipment) => {
    let next = profile.equipment.includes(e) ? profile.equipment.filter((x) => x !== e) : [...profile.equipment.filter((x) => x !== 'none' || e === 'none'), e]
    if (e === 'none') next = ['none']
    else next = next.filter((x) => x !== 'none')
    setProfile({ equipment: next.length ? next : ['none'] })
  }

  return (
    <div className={`mx-auto flex max-w-lg flex-col px-5 ${editing ? '' : 'min-h-dvh'} pb-8 pt-[calc(env(safe-area-inset-top)+16px)]`}>
      {step > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <button aria-label={t('back')} onClick={() => setStep(step - 1)} className="-ml-2 grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-white/5" disabled={editing && step === 1}>
            {!(editing && step === 1) && <ChevronLeft size={22} />}
          </button>
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: total - 1 }, (_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-cyan' : 'bg-white/10'}`} />
            ))}
          </div>
          <span className="w-9 text-right font-mono text-[11px] text-dim">{step}/{total - 1}</span>
        </div>
      )}

      {step === 0 && (
        <div className="flex flex-1 flex-col">
          <div className="grid-bg -mx-5 flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
            <LogoMark size={76} />
            <Wordmark className="mt-6 text-lg" />
            <h1 className="mt-5 text-[30px] font-extrabold leading-tight tracking-tight">{t('obWelcome')}</h1>
            <p className="mt-3 max-w-xs text-[15px] text-muted">{t('obWelcomeSub')}</p>
          </div>
          <div className="label mb-3 mt-6">{t('obLanguage')}</div>
          <div className="grid grid-cols-3 gap-2">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => setLang(l.id)} className={`h-14 rounded-2xl border text-[15px] font-semibold ${lang === l.id ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/10 bg-white/[0.03] text-muted'}`}>
                {l.native}
              </button>
            ))}
          </div>
          <Button size="lg" className="mt-5 w-full" onClick={() => setStep(1)}>{t('continue')}</Button>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-dim">
            <a href="#/legal/terms" className="underline">{t('terms')}</a> · <a href="#/legal/privacy" className="underline">{t('privacy')}</a> · <a href="#/legal/disclaimer" className="underline">{t('disclaimer')}</a>
          </p>
        </div>
      )}

      {step === 1 && (
        <Step title={t('obGoal')}>
          {GOALS.map((g) => <Option key={g} active={profile.goal === g} onClick={() => setProfile({ goal: g })} title={t(`goal_${g}`)} />)}
        </Step>
      )}
      {step === 2 && (
        <Step title={t('obLevel')}>
          {LEVELS.map((l) => <Option key={l} active={profile.level === l} onClick={() => setProfile({ level: l })} title={t(`level_${l}`)} sub={t(`level_${l}_d`)} />)}
        </Step>
      )}
      {step === 3 && (
        <Step title={t('obEquipment')}>
          <div className="grid grid-cols-2 gap-2">
            {EQUIP.map((e) => (
              <button key={e} onClick={() => toggleEq(e)} className={`flex h-14 items-center justify-between rounded-2xl border px-4 text-left text-[14px] font-semibold ${profile.equipment.includes(e) ? 'border-cyan/60 bg-cyan/[0.08] text-frost' : 'border-white/10 bg-white/[0.03] text-muted'}`}>
                {t(`eq_${e}`)}
                {profile.equipment.includes(e) && <Check size={16} className="text-cyan" />}
              </button>
            ))}
          </div>
        </Step>
      )}
      {step === 4 && (
        <Step title={t('obBody')} sub={t('obBodySub')}>
          <label className="block">
            <span className="label">{t('obName')}</span>
            <input className="field mt-1.5" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} placeholder="Darshan" autoComplete="given-name" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['male', 'female'] as const).map((s) => (
              <button key={s} onClick={() => setProfile({ sex: s })} className={`h-11 rounded-xl border text-sm font-semibold ${profile.sex === s ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/10 text-muted'}`}>{t(s)}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label><span className="label">{t('age')}</span><div className="mt-1.5"><Stepper value={profile.age} onChange={(v) => setProfile({ age: v })} min={13} max={90} /></div></label>
            <label><span className="label">{t('height')}</span><div className="mt-1.5"><Stepper value={profile.heightCm} onChange={(v) => setProfile({ heightCm: v })} min={120} max={230} /></div></label>
            <label><span className="label">{t('weight')}</span><div className="mt-1.5"><Stepper value={profile.weightKg} onChange={(v) => setProfile({ weightKg: v })} step={0.5} min={30} max={250} /></div></label>
          </div>
          <div>
            <span className="label">{t('activity')}</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {ACT.map((a, i) => (
                <button key={a} onClick={() => setProfile({ activity: a })} className={`h-11 rounded-xl border px-2 text-[13px] font-semibold ${profile.activity === a ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/10 text-muted'}`}>{t(`act_${i + 1}` as 'act_1')}</button>
              ))}
            </div>
          </div>
        </Step>
      )}

      {step > 0 && (
        <Button size="lg" className="mt-6 w-full" onClick={() => (step < total - 1 ? setStep(step + 1) : finish())}>
          {step < total - 1 ? t('continue') : editing ? t('save') : t('obFinish')}
        </Button>
      )}
    </div>
  )
}

function Step({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
      <div className="mt-6 space-y-2.5">{children}</div>
    </div>
  )
}
