import { useState } from 'react'
import { Plus, Minus, Trash2, Droplets, Moon } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Card, Header, Label, Ring, Scale, Sheet, Stepper, Tabs, Badge } from '../components/ui'
import { Bar } from './Home'
import { QUICK_FOODS } from '../data/foods'
import { dayKey, fmtDate, fmtNum, nutritionTargets, readinessBand, readinessScore } from '../lib/util'
import { cloud } from '../lib/cloud'
import { hashQuery, navigate } from '../lib/router'
import { BarChart } from '../components/Charts'

export function Fuel() {
  const t = useT()
  const [tab, setTab] = useState<'nutrition' | 'recovery'>(hashQuery().get('tab') === 'recovery' ? 'recovery' : 'nutrition')
  return (
    <div>
      <Header title={t('fuel')} back="#/home" />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'nutrition', label: t('nutrition') }, { id: 'recovery', label: t('recovery') }]} />
      <div className="mt-4">{tab === 'nutrition' ? <Nutrition /> : <Recovery />}</div>
    </div>
  )
}

function Nutrition() {
  const t = useT()
  const s = useApp()
  const today = dayKey()
  const tg = nutritionTargets(s.profile)
  const foods = s.foods.filter((f) => f.date === today)
  const sum = foods.reduce((a, f) => ({ kcal: a.kcal + f.kcal, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const water = s.water[today] ?? 0
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const add = (x: typeof f) => {
    const row = s.addFood({ ...x, date: today })
    void cloud.food(row)
    s.showToast(`+ ${x.name} · ${x.kcal} kcal`)
  }

  return (
    <div>
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Ring value={sum.kcal / tg.kcal} size={96} stroke={8} color="#f5b942">
            <div>
              <div className="text-lg font-extrabold tabular-nums leading-none">{fmtNum(Math.max(0, tg.kcal - sum.kcal))}</div>
              <div className="mt-1 text-[10px] text-muted">{t('kcal')} {t('remaining', { n: '' }).trim()}</div>
            </div>
          </Ring>
          <div className="flex-1 space-y-2">
            <Bar label={t('protein')} value={sum.protein} max={tg.protein} unit="g" color="#22d3ee" />
            <Bar label={t('carbs')} value={sum.carbs} max={tg.carbs} unit="g" color="#a78bfa" />
            <Bar label={t('fat')} value={sum.fat} max={tg.fat} unit="g" color="#f5b942" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[12px] text-muted">
          <span>{t('targets')}: <b className="text-frost">{fmtNum(tg.kcal)} kcal · {tg.protein}g {t('protein').toLowerCase()}</b></span>
          <button className="font-semibold text-cyan" onClick={() => navigate('/profile?edit=1')}>{t('edit')}</button>
        </div>
        <p className="mt-1 text-[11px] text-dim">{t('calcNote')} BMR {fmtNum(tg.bmr)} · TDEE {fmtNum(tg.tdee)}</p>
      </Card>

      <Card className="mt-3 flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan/10 text-cyan"><Droplets size={19} /></span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">{t('water')}</div>
          <div className="text-[12px] text-muted">{water} / {tg.water} {t('glasses')} (250 ml)</div>
        </div>
        <button aria-label="-" className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05]" onClick={() => s.addWater(-1)}><Minus size={16} /></button>
        <button aria-label="+" className="grid h-10 w-10 place-items-center rounded-xl bg-cyan text-black" onClick={() => s.addWater(1)}><Plus size={16} /></button>
      </Card>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <Label>{t('quickAdd')}</Label>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Plus size={15} /> {t('logFood')}</Button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {QUICK_FOODS.map((q) => (
          <button key={q.name} onClick={() => add(q)} className="card-2 w-[132px] shrink-0 p-3 text-left hover:border-white/15">
            <div className="line-clamp-2 h-9 text-[12.5px] font-semibold leading-tight">{q.name}</div>
            <div className="mt-1.5 font-mono text-[11px] text-gold">{q.kcal} kcal</div>
            <div className="font-mono text-[11px] text-cyan">{q.protein}g P</div>
          </button>
        ))}
      </div>

      <div className="label mb-2 mt-5">{t('today')}</div>
      {foods.length === 0 ? (
        <p className="card p-4 text-center text-sm text-muted">{t('empty')}</p>
      ) : (
        <Card className="divide-y divide-white/[0.05] px-4">
          {foods.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{x.name}</div>
                <div className="font-mono text-[11px] text-muted">P {x.protein} · C {x.carbs} · F {x.fat}</div>
              </div>
              <span className="font-mono text-[13px] text-gold">{x.kcal}</span>
              <button aria-label={t('delete')} className="text-dim hover:text-bad" onClick={() => { s.deleteFood(x.id); void cloud.deleteFood(x.id) }}><Trash2 size={14} /></button>
            </div>
          ))}
        </Card>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={t('logFood')}>
        <label className="block"><span className="label">{t('foodName')}</span><input className="field mt-1.5" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Paneer bhurji" /></label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><div className="label mb-1.5">{t('kcal')}</div><Stepper value={f.kcal} step={10} onChange={(v) => setF({ ...f, kcal: v })} /></div>
          <div><div className="label mb-1.5">{t('protein')} (g)</div><Stepper value={f.protein} onChange={(v) => setF({ ...f, protein: v })} /></div>
          <div><div className="label mb-1.5">{t('carbs')} (g)</div><Stepper value={f.carbs} onChange={(v) => setF({ ...f, carbs: v })} /></div>
          <div><div className="label mb-1.5">{t('fat')} (g)</div><Stepper value={f.fat} onChange={(v) => setF({ ...f, fat: v })} /></div>
        </div>
        <Button className="mt-5 w-full" disabled={!f.name.trim() || f.kcal <= 0} onClick={() => { add({ ...f, name: f.name.trim() }); setF({ name: '', kcal: 0, protein: 0, carbs: 0, fat: 0 }); setOpen(false) }}>{t('add')}</Button>
      </Sheet>
    </div>
  )
}

function Recovery() {
  const t = useT()
  const s = useApp()
  const today = dayKey()
  const existing = s.checkins.find((c) => c.date === today)
  const [c, setC] = useState({ sleepH: existing?.sleepH ?? 7, sleepQ: existing?.sleepQ ?? 3, soreness: existing?.soreness ?? 2, energy: existing?.energy ?? 3, stress: existing?.stress ?? 2 })
  const score = readinessScore(c)
  const band = readinessBand(score)
  const color = band === 'hard' ? '#34d399' : band === 'moderate' ? '#fbbf24' : '#f87171'
  const save = () => {
    const row = { ...c, date: today, score }
    s.saveCheckin(row)
    void cloud.checkin(row)
    s.showToast(`${t('readiness')}: ${score}`)
  }
  const last7 = [...s.checkins].slice(0, 7).reverse()

  return (
    <div>
      <Card className="flex items-center gap-4 p-4">
        <Ring value={score / 100} size={88} stroke={8} color={color}>
          <div className="text-2xl font-extrabold tabular-nums">{score}</div>
        </Ring>
        <div className="flex-1">
          <Label>{t('readiness')}</Label>
          <p className="mt-1 text-[14.5px] leading-snug">{t(`rec_${band}`)}</p>
        </div>
      </Card>

      <Card className="mt-3 space-y-5 p-4">
        <div className="flex items-center gap-3">
          <Moon size={18} className="text-violet" />
          <span className="flex-1 text-[14px] font-semibold">{t('sleepHours')}</span>
          <div className="w-36"><Stepper value={c.sleepH} step={0.5} min={0} max={14} onChange={(v) => setC({ ...c, sleepH: v })} /></div>
        </div>
        {([['sleepQ', t('sleepQuality'), t('low'), t('high')], ['energy', t('energy'), t('low'), t('high')], ['soreness', t('soreness'), t('low'), t('high')], ['stress', t('stress'), t('low'), t('high')]] as const).map(([k, label, lo, hi]) => (
          <div key={k}>
            <div className="mb-2 text-[14px] font-semibold">{label}</div>
            <Scale value={c[k]} onChange={(v) => setC({ ...c, [k]: v })} low={lo} high={hi} />
          </div>
        ))}
        <Button className="w-full" onClick={save}>{t('saveCheckin')}</Button>
      </Card>

      {last7.length > 0 && (
        <Card className="mt-3 p-4">
          <Label>{t('lastCheckins')}</Label>
          <div className="mt-3"><BarChart data={last7.map((x) => ({ label: fmtDate(x.date, 'en').split(' ')[0], value: x.score }))} color="#34d399" height={120} /></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{last7.slice(-3).map((x) => <Badge key={x.date} tone="muted">{fmtDate(x.date, s.lang)} · {x.sleepH}h</Badge>)}</div>
        </Card>
      )}
    </div>
  )
}
