import { useMemo, useState } from 'react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Header, Label } from '../components/ui'
import { SearchBox } from '../components/SearchBox'
import { OfflineAiPack } from '../components/OfflineAiPack'
import { Viewer } from '../components/Gallery'
import { mediaUrl } from '../components/hud'
import { SHOOT, shootName } from '../data/gallery'
import { searchMedia, type MediaHit } from '../lib/ai/mediaSearch'
import { fmtDate } from '../lib/util'

export default function MediaSearch() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const photos = useApp((s) => s.photos)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const hits = useMemo(() => (q.trim() ? searchMedia(q, { lang, photos }) : []), [q, lang, photos])
  const shootHits = hits.filter((h) => h.source === 'shoot')
  const progressHits = hits.filter((h) => h.source === 'progress')
  const shootList = shootHits.map((h) => SHOOT.find((p) => p.id === h.id)).filter(Boolean) as typeof SHOOT

  return (
    <div>
      <Header title={t('aiSearch')} back="#/analyze" sub={t('aiSearchSub')} />
      <p className="text-[12.5px] leading-relaxed text-muted">{t('aiSearchHow')}</p>
      <SearchBox wrapClass="mt-3" value={q} onValue={setQ} placeholder={t('aiSearchPh')} testid="media-search" clearLabel={t('closeLbl')} />
      {!q.trim() && <p className="mt-4 text-center text-[13px] text-muted">{t('aiSearchEmpty')}</p>}
      {q.trim() && hits.length === 0 && <p className="mt-4 text-center text-[13px] text-gold">{t('aiSearchNone', { q })}</p>}
      <div data-testid="media-search-results">
        {shootHits.length > 0 && (
          <section className="mt-4">
            <Label>{t('aiSearchShoot')} · {shootHits.length}</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {shootHits.map((h, i) => (
                <ShootTile key={h.id} hit={h} onOpen={() => setOpen(i)} />
              ))}
            </div>
          </section>
        )}
        {progressHits.length > 0 && (
          <section className="mt-4">
            <Label>{t('aiSearchProgress')} · {progressHits.length}</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {progressHits.map((h) => (
                <div key={h.id} className="overflow-hidden rounded-xl border border-white/10">
                  {h.dataUrl && <img src={h.dataUrl} alt={h.title} className="aspect-[3/4] w-full object-cover" />}
                  <div className="truncate px-1.5 py-1 font-mono text-[9px] text-muted">{h.date ? fmtDate(h.date, lang) : h.title}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      {open !== null && shootList.length > 0 && (
        <Viewer list={shootList} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
      <OfflineAiPack className="mt-4" />
    </div>
  )
}

function ShootTile({ hit, onOpen }: { hit: MediaHit; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="overflow-hidden rounded-xl border border-white/10 text-left">
      <img src={mediaUrl(shootName(hit.id), true)} alt={hit.title} className="aspect-[3/4] w-full object-cover" loading="lazy" />
      <div className="truncate px-1.5 py-1 font-mono text-[9px] uppercase tracking-wide text-muted">{hit.title}</div>
    </button>
  )
}
