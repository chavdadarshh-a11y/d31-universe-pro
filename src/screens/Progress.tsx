import { useRef, useState } from 'react'
import { Trash2, Plus, Trophy, Camera, Clock, Dumbbell, ChevronDown, Lock, Columns2 } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Confirm, Empty, Header, Label, Sheet, Stepper, Tabs } from '../components/ui'
import { BarChart, LineChart } from '../components/Charts'
import { EX_BY_ID, exName } from '../data/exercises'
import { compressImage, computeStreak, dayKey, fmtClock, fmtDate, fmtNum, weeklyBuckets } from '../lib/util'
import { computeRecords } from '../lib/workout'
import { cloud } from '../lib/cloud'
import { hashQuery, navigate } from '../lib/router'
import { hasPlan } from '../lib/plans'
import type { Measurement } from '../types'

type Tab = 'history' | 'charts' | 'body' | 'records' | 'photos'

export function Progress() {
  const t = useT()
  const s = useApp()
  const initial = (hashQuery().get('tab') as Tab) || 'history'
  const [tab, setTab] = useState<Tab>(initial)
  const totalVolume = s.sessions.reduce((v, x) => v + x.volumeKg, 0)

  return (
    <div>
      <Header title={t('navProgress')} />
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          [t('totalWorkouts'), String(s.sessions.length)],
          [t('totalVolume'), `${fmtNum(totalVolume / 1000 >= 10 ? totalVolume / 1000 : totalVolume)}${totalVolume / 1000 >= 10 ? 't' : 'kg'}`],
          [t('streak'), String(computeStreak(s.sessions))],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="text-[20px] font-extrabold tabular-nums">{v}</div>
            <div className="truncate text-[11px] text-muted">{k}</div>
          </div>
        ))}
      </div>
      <Tabs value={tab} onChange={setTab} items={[
        { id: 'history', label: t('history') }, { id: 'charts', label: t('charts') }, { id: 'body', label: t('body') },
        { id: 'records', label: t('records') }, { id: 'photos', label: t('photos') },
      ]} />
      <div className="mt-4">
        {tab === 'history' && <History />}
        {tab === 'charts' && <Charts />}
        {tab === 'body' && <Body />}
        {tab === 'records' && <Records />}
        {tab === 'photos' && <Photos />}
      </div>
    </div>
  )
}

function History() {
  const t = useT()
  const s = useApp()
  const [open, setOpen] = useState<string | null>(null)
  const [del, setDel] = useState<string | null>(null)
  if (!s.sessions.length) return <Empty icon={<Dumbbell size={28} />} text={t('noHistory')} action={<Button size="sm" onClick={() => navigate('/train')}>{t('choose')}</Button>} />
  return (
    <div className="space-y-2">
      {s.sessions.map((x) => {
        const sets = x.exercises.reduce((n, e) => n + e.sets.length, 0)
        const isOpen = open === x.id
        return (
          <Card key={x.id} className="p-0">
            <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : x.id)}>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-center leading-none">
                <div><div className="text-[15px] font-bold">{new Date(x.startedAt).getDate()}</div><div className="mt-0.5 text-[9px] uppercase text-muted">{new Date(x.startedAt).toLocaleDateString('en-IN', { month: 'short' })}</div></div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{x.name}</div>
                <div className="mt-0.5 flex gap-3 text-[12px] text-muted">
                  <span className="flex items-center gap-1"><Clock size={12} />{fmtClock(x.durationSec)}</span>
                  <span>{sets} {t('sets').toLowerCase()}</span>
                  {x.volumeKg > 0 && <span>{fmtNum(x.volumeKg)} kg</span>}
                </div>
              </div>
              {x.source === 'camera' && <Badge tone="violet">CAM</Badge>}
              <ChevronDown size={18} className={`text-dim transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="border-t border-white/[0.06] px-4 pb-3 pt-2">
                {x.exercises.map((e, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-1.5 text-[13px]">
                    <span className="text-frost/90">{EX_BY_ID[e.exId] ? exName(EX_BY_ID[e.exId], s.lang) : e.exId}</span>
                    <span className="text-right font-mono text-[12px] text-muted">{e.sets.map((st) => (st.secs && !st.reps ? `${st.secs}s` : st.kg ? `${st.kg}×${st.reps}` : `${st.reps}`)).join('  ')}</span>
                  </div>
                ))}
                <button className="mt-2 flex items-center gap-1.5 text-[12px] text-bad" onClick={() => setDel(x.id)}><Trash2 size={13} /> {t('delete')}</button>
              </div>
            )}
          </Card>
        )
      })}
      <Confirm open={!!del} text={`${t('delete')}?`} confirmLabel={t('delete')} cancelLabel={t('cancel')} danger onClose={() => setDel(null)} onConfirm={() => { if (del) { s.deleteSession(del); void cloud.deleteSession(del) } }} />
    </div>
  )
}

function Charts() {
  const t = useT()
  const s = useApp()
  const weeks = weeklyBuckets(s.sessions, 8)
  const label = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
  const weights = s.measurements.filter((m) => m.weightKg).slice(-12)
  return (
    <div className="space-y-3">
      <Card className="p-4"><Label>{t('weeklyVolume')}</Label><div className="mt-3"><BarChart data={weeks.map((w) => ({ label: label(w.start), value: w.volume }))} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))} /></div></Card>
      <Card className="p-4"><Label>{t('weeklyWorkouts')}</Label><div className="mt-3"><BarChart data={weeks.map((w) => ({ label: label(w.start), value: w.count }))} color="#a78bfa" height={120} /></div></Card>
      <Card className="p-4">
        <Label>{t('bodyWeight')}</Label>
        <div className="mt-3">
          {weights.length ? <LineChart data={weights.map((m) => ({ label: fmtDate(m.date, 'en').replace(' ', '\u00a0'), value: m.weightKg! }))} unit="" /> : <p className="py-6 text-center text-sm text-muted">{t('addMeasurement')} → {t('body')}</p>}
        </div>
      </Card>
    </div>
  )
}

function Body() {
  const t = useT()
  const s = useApp()
  const last = s.measurements[s.measurements.length - 1]
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Omit<Measurement, 'id'>>({ date: dayKey(), weightKg: last?.weightKg ?? s.profile.weightKg, waistCm: last?.waistCm, chestCm: last?.chestCm, armCm: last?.armCm, thighCm: last?.thighCm, bodyFat: last?.bodyFat })
  const fields: [keyof Measurement, string, number][] = [['weightKg', t('weight'), 0.1], ['waistCm', t('waist'), 0.5], ['chestCm', t('chest'), 0.5], ['armCm', t('arm'), 0.5], ['thighCm', t('thigh'), 0.5], ['bodyFat', t('bodyFat'), 0.5]]
  const save = () => {
    const m = s.addMeasurement(form)
    void cloud.measurement(m)
    if (form.weightKg) s.setProfile({ weightKg: form.weightKg })
    setOpen(false)
  }
  const rows = [...s.measurements].reverse()
  return (
    <div>
      <Button className="w-full" onClick={() => setOpen(true)}><Plus size={16} /> {t('addMeasurement')}</Button>
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <Empty text={t('empty')} />}
        {rows.map((m, i) => {
          const prev = rows[i + 1]
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold">{fmtDate(m.date, s.lang)}</span>
                <button aria-label={t('delete')} className="text-dim hover:text-bad" onClick={() => { s.deleteMeasurement(m.id); void cloud.deleteMeasurement(m.id) }}><Trash2 size={14} /></button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
                {fields.map(([k, label]) => {
                  const v = m[k] as number | undefined
                  if (v === undefined || v === null) return null
                  const pv = prev?.[k] as number | undefined
                  const d = pv !== undefined ? +(v - pv).toFixed(1) : 0
                  return (
                    <div key={k}>
                      <div className="truncate text-[10.5px] text-dim">{label.replace(/ \(.*\)/, '')}</div>
                      <div className="text-[15px] font-bold tabular-nums">{v}{d !== 0 && <span className={`ml-1 text-[11px] font-medium ${d < 0 ? 'text-ok' : 'text-gold'}`}>{d > 0 ? '+' : ''}{d}</span>}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('addMeasurement')}>
        <label className="block"><span className="label">{t('date')}</span><input type="date" className="field mt-1.5" value={form.date} max={dayKey()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {fields.map(([k, label, step]) => (
            <div key={k}><div className="label mb-1.5">{label}</div><Stepper value={(form[k as keyof typeof form] as number) ?? 0} step={step} onChange={(v) => setForm({ ...form, [k]: v || undefined })} /></div>
          ))}
        </div>
        <Button className="mt-5 w-full" onClick={save}>{t('save')}</Button>
      </Sheet>
    </div>
  )
}

function Records() {
  const t = useT()
  const s = useApp()
  const recs = computeRecords(s.sessions)
  if (!recs.length) return <Empty icon={<Trophy size={28} />} text={t('noRecords')} />
  return (
    <div className="space-y-2">
      {recs.map((r) => (
        <Card key={r.exId} className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/12 text-gold"><Trophy size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{exName(EX_BY_ID[r.exId], s.lang)}</div>
            <div className="text-[12px] text-muted">{fmtDate(r.date, s.lang)}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[16px] font-bold text-gold">{r.kind === 'weight' ? `${r.kg} × ${r.reps}` : r.kind === 'time' ? `${r.value}s` : `${r.value}`}</div>
            <div className="text-[10.5px] text-dim">{r.kind === 'weight' ? `${t('est1rm')} ${Math.round(r.value)} kg` : r.kind === 'reps' ? t('reps') : t('hold')}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function Photos() {
  const t = useT()
  const s = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [sel, setSel] = useState<string[]>([])
  const [compare, setCompare] = useState(false)
  const [del, setDel] = useState<string | null>(null)
  const allowed = hasPlan(effectivePlan(s.membership), 'pro')

  const add = async (f: File | undefined) => {
    if (!f) return
    const dataUrl = await compressImage(f, 900, 0.82)
    const p = s.addPhoto({ date: new Date().toISOString(), dataUrl })
    void cloud.photo(p)
  }
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel.slice(-1), id])
  const pair = sel.map((id) => s.photos.find((p) => p.id === id)).filter(Boolean) as typeof s.photos

  if (!allowed)
    return (
      <Empty icon={<Lock size={26} />} text={`${t('f_photos')} — ${t('planNeeded', { p: t('plan_pro') })}`} action={<Button variant="gold" size="sm" onClick={() => navigate('/membership')}>{t('unlockWith', { p: t('plan_pro') })}</Button>} />
    )

  return (
    <div>
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { void add(e.target.files?.[0]); e.target.value = '' }} />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => input.current?.click()}><Camera size={16} /> {t('addPhoto')}</Button>
        <Button variant="outline" disabled={pair.length !== 2} onClick={() => setCompare(true)}><Columns2 size={16} /> {t('compare')}</Button>
      </div>
      <p className="mt-2 text-[12px] text-dim">{s.photos.length >= 2 ? t('pickTwo') : t('photoPrivate')}</p>
      {s.photos.length === 0 ? (
        <div className="mt-3"><Empty icon={<Camera size={28} />} text={t('noPhotos')} /></div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {s.photos.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)} onContextMenu={(e) => { e.preventDefault(); setDel(p.id) }} className={`relative aspect-[3/4] overflow-hidden rounded-xl border-2 ${sel.includes(p.id) ? 'border-cyan' : 'border-transparent'}`}>
              <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[10.5px]">{fmtDate(p.date, s.lang)}</span>
              {sel.includes(p.id) && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-cyan text-[11px] font-bold text-black">{sel.indexOf(p.id) + 1}</span>}
            </button>
          ))}
        </div>
      )}
      {sel.length === 1 && <button className="mt-3 flex items-center gap-1.5 text-[12px] text-bad" onClick={() => setDel(sel[0])}><Trash2 size={13} /> {t('delete')}</button>}
      <Sheet open={compare} onClose={() => setCompare(false)} title={t('compare')}>
        <div className="grid grid-cols-2 gap-2">
          {[...pair].sort((a, b) => a.date.localeCompare(b.date)).map((p) => (
            <div key={p.id}>
              <img src={p.dataUrl} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
              <div className="mt-1 text-center text-[12px] text-muted">{fmtDate(p.date, s.lang)}</div>
            </div>
          ))}
        </div>
      </Sheet>
      <Confirm open={!!del} text={`${t('delete')}?`} confirmLabel={t('delete')} cancelLabel={t('cancel')} danger onClose={() => setDel(null)} onConfirm={() => { if (del) { s.deletePhoto(del); void cloud.deletePhoto(del); setSel([]) } }} />
    </div>
  )
}
