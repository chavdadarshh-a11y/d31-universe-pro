import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X, FileText, PlayCircle, Plus } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Card, Chip, CHIP_COLORS, Empty, Header, Label, Sheet, Tabs } from '../components/ui'
import { BodyThumb, BACK_IDS, FRONT_IDS } from '../components/BodyMap'
import { allExercises, exName, exOf } from '../data/exercises'
import { LADDERS } from '../data/ladders'
import { ClipPlayer, Photo } from '../components/hud'
import { ShootGallery } from '../components/Gallery'
import { CustomExerciseSheet } from '../components/ExercisePicker'
import { ladderStatus } from '../lib/training'
import { hashQuery } from '../lib/router'
import { SAMPLE_POSTS } from '../data/posts'
import { fetchPosts, type D31Post } from '../lib/posts'
import { navigate } from '../lib/router'
import { isLive } from '../lib/env'
import type { Category, Equipment, Exercise, MuscleId } from '../types'

const MUSCLES: MuscleId[] = ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'traps', 'lats', 'upper_back', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves', 'rear_delts']
const CATS: Category[] = ['strength', 'calisthenics', 'mobility', 'cardio']
const EQUIP: Equipment[] = ['none', 'dumbbell', 'barbell', 'bar', 'bench', 'kettlebell', 'cable']

// your own exercises first, then the ones with Darshan's video clips, then the rest (stable sort)
const rank = (e: Exercise) => (e.custom ? 0 : e.clip ? 1 : 2)

const realLink = (u: string) => !!u && !u.includes('example.com')

function Thumb({ e }: { e: Exercise }) {
  if (e.clip) return <div className="relative h-[76px] w-[56px] shrink-0 overflow-hidden rounded-xl border border-gold/30"><ClipPlayer name={e.clip} alt="" /></div>
  if (e.media) return <div className="relative h-[76px] w-[56px] shrink-0 overflow-hidden rounded-xl border border-gold/30"><Photo name={e.media} small alt="" /></div>
  const backOnly = (m: MuscleId) => BACK_IDS.has(m) && !FRONT_IDS.has(m)
  const frontOnly = (m: MuscleId) => FRONT_IDS.has(m) && !BACK_IDS.has(m)
  const backHeavy = e.primary.filter(backOnly).length > e.primary.filter(frontOnly).length
  return (
    <div className="h-[76px] w-[56px] shrink-0 rounded-xl bg-[#0a0d12] py-1.5">
      <BodyThumb primary={e.primary} secondary={e.secondary} view={backHeavy ? 'back' : 'front'} />
    </div>
  )
}

export function Library() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const customs = useApp((s) => s.customExercises)
  const sessions = useApp((s) => s.sessions)
  const [tab, setTab] = useState<'ex' | 'paths' | 'shoot' | 'kn'>(() => (hashQuery().get('tab') as 'paths') || 'ex')
  const [create, setCreate] = useState(false)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | null>(null)
  const [muscle, setMuscle] = useState<MuscleId | null>(null)
  const [equip, setEquip] = useState<Equipment | null>(null)
  const [level, setLevel] = useState<1 | 2 | 3 | null>(null)
  const [filters, setFilters] = useState(false)
  const [posts, setPosts] = useState<D31Post[]>(SAMPLE_POSTS)
  const [post, setPost] = useState<D31Post | null>(null)

  useEffect(() => {
    if (tab !== 'kn' || !isLive) return
    const id = setTimeout(() => fetchPosts(q).then((p) => p && setPosts(p)), 250)
    return () => clearTimeout(id)
  }, [q, tab])

  const ql = q.trim().toLowerCase()
  const list = useMemo(
    () =>
      allExercises().filter(
        (e) =>
          (!ql || [e.name, e.nameHi, e.nameGu, e.summary, ...e.primary.map((m) => t(`m_${m}`))].some((x) => x.toLowerCase().includes(ql))) &&
          (!cat || e.category === cat) &&
          (!muscle || e.primary.includes(muscle) || e.secondary.includes(muscle)) &&
          (!equip || e.equipment.includes(equip)) &&
          (!level || e.level === level),
      ).sort((a, b) => rank(a) - rank(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ql, cat, muscle, equip, level, lang, customs],
  )
  const shownPosts = isLive ? posts : posts.filter((p) => !ql || `${p.title} ${p.core_skill} ${p.layer} ${p.skills.join(' ')}`.toLowerCase().includes(ql))
  const nFilters = [muscle, equip, level].filter((x) => x !== null).length
  const levelLabel = (l: 1 | 2 | 3) => t(l === 1 ? 'level_beginner' : l === 2 ? 'level_intermediate' : 'level_advanced')

  return (
    <div>
      <Header title={t('navLibrary')} sub={t('librarySub')} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'ex', label: t('exercises') }, { id: 'paths', label: t('skillPaths') }, { id: 'shoot', label: t('galleryTab') }, { id: 'kn', label: t('learnTab') }]} />
      {tab === 'shoot' && <ShootGallery />}
      {tab === 'paths' && (
        <div className="mt-3 space-y-3">
          <p className="text-[13px] leading-snug text-muted">{t('skillPathsSub')}</p>
          {LADDERS.map((l) => {
            const st = ladderStatus(l, sessions)
            return (
              <Card key={l.id} onClick={() => navigate(`/path/${l.id}`)} className="relative flex items-center gap-3 overflow-hidden p-3">
                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: `${l.accent}55` }}>
                  {l.media ? <Photo name={l.media} small alt="" /> : <div className="h-full w-full" style={{ background: `radial-gradient(circle at 30% 30%, ${l.accent}44, transparent 70%)` }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="title-hud text-[13.5px]">{l.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">{t('currentStep')}: {exName(exOf(l.steps[st.current].exId), lang)}</div>
                  <div className="mt-2 flex gap-0.5">{l.steps.map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: st.cleared[k] ? l.accent : k === st.current ? `${l.accent}66` : 'rgba(255,255,255,0.1)' }} />)}</div>
                </div>
                <span className="font-mono text-[11px]" style={{ color: l.accent }}>{st.current + 1}/{l.steps.length}</span>
              </Card>
            )
          })}
        </div>
      )}
      {(tab === 'ex' || tab === 'kn') && <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input className="field pl-9" placeholder={t('searchPh')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </div>
        {tab === 'ex' && (
          <button onClick={() => setFilters(true)} className="relative grid h-[46px] w-[46px] place-items-center rounded-xl border border-white/10 text-muted" aria-label={t('filters')}>
            <SlidersHorizontal size={18} />
            {nFilters > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-cyan text-[11px] font-bold text-black">{nFilters}</span>}
          </button>
        )}
      </div>}

      {tab === 'ex' && (
        <>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <Chip active={!cat} onClick={() => setCat(null)}>{t('all')}</Chip>
            {CATS.map((c, i) => <Chip key={c} color={CHIP_COLORS[i % CHIP_COLORS.length]} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>{t(`cat_${c}`)}</Chip>)}
          </div>
          {nFilters > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {muscle && <Chip active onClick={() => setMuscle(null)}>{t(`m_${muscle}`)} <X size={12} className="ml-1 inline" /></Chip>}
              {equip && <Chip active onClick={() => setEquip(null)}>{t(`eq_${equip}`)} <X size={12} className="ml-1 inline" /></Chip>}
              {level && <Chip active onClick={() => setLevel(null)}>{levelLabel(level)} <X size={12} className="ml-1 inline" /></Chip>}
            </div>
          )}
          <div className="mb-2 mt-4 flex items-center justify-between">
            <span className="label">{t('results', { n: list.length })}</span>
            <button onClick={() => setCreate(true)} className="flex items-center gap-1 text-[12px] font-semibold text-gold"><Plus size={14} /> {t('createExercise')}</button>
          </div>
          {list.length === 0 && <Empty text={t('noResults')} />}
          <div className="space-y-2">
            {list.map((e) => (
              <Card key={e.id} onClick={() => navigate(`/library/${e.id}`)} className="flex items-center gap-3 p-2.5 pr-4">
                <Thumb e={e} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{exName(e, lang)}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-muted">{e.primary.map((m) => t(`m_${m}`)).join(' · ')}</div>
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge tone="muted">{t(`cat_${e.category}`)}</Badge>
                    <Badge tone={e.level === 3 ? 'violet' : 'muted'}>{levelLabel(e.level)}</Badge>
                    {e.custom && <Badge tone="gold">{t('customTag')}</Badge>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === 'kn' && (
        <div className="mt-3 space-y-3">
          {!isLive && <p className="text-[12px] text-dim">{t('demo')} · sample posts</p>}
          {shownPosts.map((p) => (
            <Card key={p.post_id} onClick={() => setPost(p)} className="overflow-hidden">
              <div className="relative h-36 bg-panel-2">
                <img src={p.cover_url} alt="" loading="lazy" className="h-full w-full object-cover opacity-80" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e1117] via-transparent" />
                <Badge tone="cyan" className="absolute left-3 top-3">{p.layer}</Badge>
              </div>
              <div className="p-4 pt-1">
                <h3 className="text-[16px] font-bold leading-snug">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.content.summary}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CustomExerciseSheet open={create} onClose={() => setCreate(false)} onSaved={(e) => navigate(`/library/${e.id}`)} />

      <Sheet open={filters} onClose={() => setFilters(false)} title={t('filters')}>
        <Label>{t('muscle')}</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">{MUSCLES.map((m) => <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{t(`m_${m}`)}</Chip>)}</div>
        <Label className="mt-5">{t('equipment')}</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">{EQUIP.map((e) => <Chip key={e} active={equip === e} onClick={() => setEquip(equip === e ? null : e)}>{t(`eq_${e}`)}</Chip>)}</div>
        <Label className="mt-5">{t('level')}</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">{([1, 2, 3] as const).map((l) => <Chip key={l} active={level === l} onClick={() => setLevel(level === l ? null : l)}>{levelLabel(l)}</Chip>)}</div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => { setMuscle(null); setEquip(null); setLevel(null) }}>{t('all')}</Button>
          <Button onClick={() => setFilters(false)}>{t('results', { n: list.length })}</Button>
        </div>
      </Sheet>

      <Sheet open={!!post} onClose={() => setPost(null)} title={post?.title}>
        {post && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5"><Badge tone="cyan">{post.layer}</Badge>{post.skills.map((s) => <Badge key={s} tone="muted">{s}</Badge>)}</div>
            {(['summary', 'technique', 'biomechanics', 'coaching'] as const).map((k) => post.content[k] && (
              <div key={k}><Label>{k}</Label><p className="mt-1.5 text-[14px] leading-relaxed text-frost/90">{post.content[k]}</p></div>
            ))}
            {post.videos.filter(realLink).map((v) => <a key={v} href={v} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-cyan"><PlayCircle size={16} /> Video</a>)}
            {post.pdfs.filter(realLink).map((v) => <a key={v} href={v} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-cyan"><FileText size={16} /> PDF</a>)}
          </div>
        )}
      </Sheet>
    </div>
  )
}
