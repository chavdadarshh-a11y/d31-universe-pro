import { useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { useApp } from '../store/app'
import { useT, LANGS } from '../i18n'
import { Button, Stepper } from '../components/ui'
import { LogoMark, Wordmark } from '../components/Brand'
import { Photo } from '../components/hud'
import { navigate, hashQuery } from '../lib/router'
import type { Equipment, Goal, Level, Profile } from '../types'
import { PROGRAMS } from '../data/programs'
import { cloud } from '../lib/cloud'
import { useUnits, AGE, HEIGHT_CM, HEIGHT_IN, WEIGHT_KG, WEIGHT_LB, clampHeightCm, clampWeightKg } from '../lib/units'
import { useSettings } from '../store/settings'

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
  const { lang, setLang, profile, setProfile, completeOnboarding, set, user } = useApp()
  const [step, setStep] = useState(editing || user || hashQuery().get('guest') === '1' ? 1 : 0)
  const total = 5
  const u = useUnits()
  const setSettings = useSettings((st) => st.set)

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
          <div className="card hud-full scanlines holo-sweep relative flex min-h-[420px] flex-1 flex-col items-center justify-end overflow-hidden px-5 pb-7 text-center">
            <Photo name="back-lever" alt={t('photoOf', { x: 'Back Lever' })} eager />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,6,12,0.35)_0%,rgba(4,6,12,0.1)_35%,rgba(4,6,12,0.95)_80%)]" />
            <div className="relative z-[2] flex flex-col items-center">
              <span className="rounded-2xl shadow-[0_0_30px_-4px_rgba(247,197,72,0.7)]"><LogoMark size={64} /></span>
              <Wordmark className="mt-4 text-lg" />
              <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.26em] text-cyan/90">{t('heroKicker')}</div>
              <h1 className="title-hud mt-3 text-[24px] leading-tight">{t('obWelcome')}</h1>
              <p className="mt-2 max-w-xs text-[14px] text-frost/80">{t('obWelcomeSub')}</p>
            </div>
          </div>
          <div className="card mt-4 p-4">
            <div className="label mb-3">{t('obLanguage')}</div>
            <div className="flex items-center justify-between pt-1">
            <span className="label">{t('weightUnit')}</span>
            <div className="flex gap-1.5">
              {(['kg', 'lb'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setSettings({ weightUnit: unit })}
                  className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold uppercase ${u.w === unit ? 'border-cyan/60 bg-cyan/15 text-cyan' : 'border-white/10 text-muted'}`}
                >
                  {unit === 'kg' ? 'KG' : 'LBS'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
              {LANGS.map((l) => (
                <button key={l.id} onClick={() => setLang(l.id)} className={`h-12 rounded-2xl border text-[15px] font-semibold ${lang === l.id ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/10 bg-white/[0.03] text-muted'}`}>
                  {l.native}
                </button>
              ))}
            </div>
            <Button size="lg" className="mt-4 w-full" data-testid="ob-create" onClick={() => navigate('/auth?mode=up')}>{t('createAccount')}</Button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="outline" data-testid="ob-login" onClick={() => navigate('/auth?mode=in')}>{t('signIn')}</Button>
              <Button variant="ghost" data-testid="ob-guest" onClick={() => setStep(1)}>{t('guest')}</Button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-dim">
              <a href="#/legal/terms" className="underline">{t('terms')}</a> · <a href="#/legal/privacy" className="underline">{t('privacy')}</a> · <a href="#/legal/disclaimer" className="underline">{t('disclaimer')}</a>
            </p>
          </div>
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
        <Step title={t('obBody')} sub={t('obBodyOptional')}>
          <label className="block">
            <span className="label">{t('obName')}</span>
            <input className="field mt-1.5" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} placeholder="Darshan" autoComplete="given-name" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['male', 'female'] as const).map((s) => (
              <button key={s} onClick={() => setProfile({ sex: s })} className={`h-11 rounded-xl border text-sm font-semibold ${profile.sex === s ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-white/10 text-muted'}`}>{t(s)}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3" data-testid="ob-body">
            <div><span className="label">{t('age')}</span><div className="mt-1.5"><Stepper testid="ob-age" label={t('age')} value={profile.age} onChange={(v) => setProfile({ age: Math.round(v) })} min={AGE.min} max={AGE.max} /></div></div>
            <div><span className="label">{t('height').replace(/\s*\([^)]*\)\s*$/, '')} ({u.l})</span><div className="mt-1.5"><Stepper testid="ob-height" label={t('height')} value={u.toL(profile.heightCm)} onChange={(v) => setProfile({ heightCm: clampHeightCm(u.fromL(v)) })} step={u.l === 'in' ? 0.5 : 1} min={u.l === 'in' ? HEIGHT_IN.min : HEIGHT_CM.min} max={u.l === 'in' ? HEIGHT_IN.max : HEIGHT_CM.max} /></div></div>
            <div><span className="label">{t('weight').replace(/\s*\([^)]*\)\s*$/, '')} ({u.w})</span><div className="mt-1.5"><Stepper testid="ob-weight" label={t('weight')} value={u.toW(profile.weightKg)} onChange={(v) => setProfile({ weightKg: clampWeightKg(u.fromW(v)) })} step={u.w === 'lb' ? 1 : 0.5} min={u.w === 'lb' ? WEIGHT_LB.min : WEIGHT_KG.min} max={u.w === 'lb' ? WEIGHT_LB.max : WEIGHT_KG.max} /></div></div>
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
        <Button size="lg" className="mt-6 w-full" data-testid="ob-next" onClick={() => (step < total - 1 ? setStep(step + 1) : finish())}>
          {step < total - 1 ? t('continue') : editing ? t('save') : t('obFinish')}
        </Button>
      )}
      {step === total - 1 && !editing && <button className="mt-2 w-full py-2 text-[13px] text-muted" onClick={finish}>{t('skipForNow')}</button>}
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
