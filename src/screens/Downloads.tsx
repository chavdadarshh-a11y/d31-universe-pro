import { useEffect, useState } from 'react'
import { useUnlocks } from '../lib/unlocks'
import { UNLOCKS } from '../config/plans'
import { createPortal } from 'react-dom'
import { CloudOff, Cloud, Download, FileText, Film, HardDrive, Image as ImageIcon, Lock, Play, RefreshCw, Trash2, X } from 'lucide-react'
import { useT } from '../i18n'
import { useApp } from '../store/app'
import { useSettings } from '../store/settings'
import { Button, Card, Empty, Header } from '../components/ui'
import { Switch } from '../components/Switch'
import { openPlayer } from '../components/VideoPlayer'
import { PdfViewer } from '../components/PdfViewer'
import { navigate } from '../lib/router'
import { useDownloadAccess } from '../lib/entitlements'
import { cloudRestoreReady, fmtBytes, getBlob, savedUrl, storageUsed, useDownloads, type DlItem } from '../lib/downloads'
import { kPreview } from '../lib/knowledge'
import { IN_APP } from '../lib/appMode'

const ICON = { video: Film, pdf: FileText, photo: ImageIcon }

export function Downloads() {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const access = useDownloadAccess()
  const st = useSettings()
  const { list, present, progress, refresh, remove, restoreMissing, save } = useDownloads()
  const [used, setUsed] = useState<number | null>(null)
  const [pdf, setPdf] = useState<{ blob: Blob; title: string } | null>(null)
  const [photo, setPhoto] = useState<{ url: string; title: string } | null>(null)
  const toast = useApp((s) => s.showToast)
  useEffect(() => { void refresh().then(() => storageUsed().then(setUsed)) }, [refresh])
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  const locked = access.state === 'locked'
  const ukeys = useUnlocks((x) => x.keys)
  const itemLocked = (it: DlItem) => locked && !(UNLOCKS.allowDownload && it.unlock && ukeys[it.unlock])
  const missing = list.filter((x) => !present[x.item_id])
  const fmtT = (ms: number) => new Date(ms).toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { dateStyle: 'medium', timeStyle: 'short' })

  const open = async (it: DlItem) => {
    if (itemLocked(it)) return IN_APP ? toast(t('memberOnly')) : navigate('/membership')
    if (it.type === 'video') {
      const url = await savedUrl(it.item_id)
      if (url) openPlayer({ items: [{ title: it.title, sub: `${it.post ? `#${it.post} · ` : ''}${t('dlOffline')}`, sources: [{ src: url, type: it.mime || 'video/mp4' }], embed: kPreview(it.source_id) }] })
    } else if (it.type === 'pdf') {
      const b = await getBlob(it.item_id)
      if (b) setPdf({ blob: b, title: it.title })
    } else {
      const url = await savedUrl(it.item_id)
      if (url) setPhoto({ url, title: it.title })
    }
  }

  return (
    <div data-testid="downloads-screen">
      <Header title={t('dlTitle')} sub={t('dlSub')} back />

      {access.state === 'grace' && access.graceUntil && (
        <div data-testid="dl-grace-banner" className="mb-3 rounded-2xl border border-gold/40 bg-gold/[0.08] p-3 text-[13px] text-gold">{t('dlUnlockedUntil', { t: fmtT(access.graceUntil) })}</div>
      )}
      {locked && list.some(itemLocked) && (
        <div data-testid="dl-locked-banner" className="mb-3 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/[0.08] p-3">
          <Lock size={18} className="shrink-0 text-gold" />
          <p className="flex-1 text-[13px] text-gold">{t('dlLocked')} · {IN_APP ? t('memberOnly') : t('dlRenew')}</p>
          {!IN_APP && <Button variant="gold" size="sm" onClick={() => navigate('/membership')}>{t('renew')}</Button>}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className="p-3"><HardDrive size={16} className="text-cyan" /><div className="mt-1.5 text-[18px] font-bold">{t('dlCount', { n: list.length })}</div><div className="text-[11.5px] text-muted">{used !== null ? t('dlUsed', { x: fmtBytes(used) }) : '—'}</div></Card>
        <Card className="p-3">{cloudRestoreReady() ? <Cloud size={16} className="text-ok" /> : <CloudOff size={16} className="text-gold" />}<p className="mt-1.5 text-[11.5px] leading-snug text-muted">{cloudRestoreReady() ? t('dlCloudOn') : t('dlCloudDemo')}</p></Card>
      </div>

      {missing.length > 0 && !locked && (
        <Card className="mb-3 p-3" data-testid="dl-missing">
          <p className="text-[13px]">{t('dlMissing', { n: missing.length })}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" data-testid="dl-restore" onClick={async () => { const n = await restoreMissing(); toast(`${t('dlSaved')} · ${n}`) }}><RefreshCw size={14} /> {t('dlRestore')}</Button>
            <span className="ml-auto text-[12px] text-muted">{t('dlAutoWifi')}</span>
            <Switch testid="dl-autowifi" label={t('dlAutoWifi')} on={st.dlAutoWifi} onChange={(v) => st.set({ dlAutoWifi: v })} />
          </div>
        </Card>
      )}

      {!list.length ? <Empty icon={<Download size={28} />} text={t('dlEmpty')} /> : (
        <div className="space-y-2">
          {list.map((it) => {
            const Icon = ICON[it.type]
            const here = present[it.item_id]
            const prog = progress[it.item_id]
            const lockedIt = itemLocked(it)
            return (
              <Card key={it.item_id} className="flex items-center gap-3 p-3" data-testid={`dl-item-${it.type}`}>
                <button onClick={() => (here ? open(it) : undefined)} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid="dl-open" disabled={!here}>
                  <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${lockedIt ? 'border-gold/30 bg-gold/[0.07] text-gold' : 'border-cyan/25 bg-cyan/[0.07] text-cyan'}`}>
                    {lockedIt ? <Lock size={18} /> : it.type === 'video' && here ? <Play size={18} fill="currentColor" /> : <Icon size={19} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{it.title}</span>
                    <span className="block truncate font-mono text-[10.5px] text-dim">
                      {it.post ? `#${it.post} · ` : ''}{fmtBytes(it.size)} · {new Date(it.downloaded_at).toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`)}
                      {lockedIt ? ` · ${IN_APP ? t('dlLocked') : t('dlRenew')}` : !here ? ` · ${t('dlRestore')}` : ''}
                    </span>
                  </span>
                </button>
                {prog !== undefined ? <span className="font-mono text-[12px] text-cyan">{Math.round(prog * 100)}%</span>
                  : !here && !lockedIt ? <button aria-label={t('dlRestore')} onClick={() => void save(it)} className="grid h-9 w-9 place-items-center rounded-xl border border-cyan/30 text-cyan"><RefreshCw size={15} /></button> : null}
                <button aria-label={t('dlDelete')} data-testid="dl-delete" onClick={async () => { await remove(it.item_id); toast(t('dlDeleted')); storageUsed().then(setUsed) }} className="grid h-9 w-9 place-items-center rounded-xl border border-bad/30 text-bad"><Trash2 size={15} /></button>
              </Card>
            )
          })}
        </div>
      )}
      <p className="mt-4 text-[11.5px] leading-snug text-dim">{t(IN_APP ? 'graceRuleApp' : 'graceRule')}</p>

      {pdf && <PdfViewer blob={pdf.blob} title={pdf.title} onClose={() => setPdf(null)} />}
      {photo && createPortal(
        <div className="dark-zone fixed inset-0 z-[80] flex flex-col bg-black/95" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between p-3 pt-[calc(env(safe-area-inset-top)+12px)] text-white">
            <span className="truncate text-[13px]">{photo.title}</span>
            <button onClick={() => setPhoto(null)} aria-label={t('pClose')} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><X size={20} /></button>
          </div>
          <div className="flex flex-1 items-center justify-center p-2"><img src={photo.url} alt={photo.title} className="max-h-full max-w-full rounded-lg object-contain" /></div>
        </div>, document.body)}
    </div>
  )
}
