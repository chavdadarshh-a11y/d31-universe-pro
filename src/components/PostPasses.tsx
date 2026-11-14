import { useEffect, useState } from 'react'
import { Clock, Lock } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { Button, Sheet } from './ui'
import { IN_APP } from '../lib/appMode'
import { isLive } from '../lib/env'
import { POST_PASSES, POST_PASS_BY_ID, postPassDuration, type PostPassId, type PostPassConfig } from '../config/plans'
import {
  activePasses, buyPostPass, capacityOf, formatRemain, postAccess, totalOpenSlots,
  usePostPasses,
  type UserPostPass,
} from '../lib/postPasses'
import { trustedNow } from '../lib/plans'
import { postTitle, useKnowledge, visiblePosts, type KPost } from '../lib/knowledge'

export const showsPostPasses = (plan: string) => !IN_APP && plan !== 'platinum'

export function Remain({ until, testid = 'pp-countdown' }: { until: number; testid?: string }) {
  const t = useT()
  const [now, setNow] = useState(() => trustedNow())
  useEffect(() => {
    const tick = () => setNow(trustedNow())
    const id = setInterval(tick, until - trustedNow() < 2 * 3600_000 ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [until])
  const s = formatRemain(until, now)
  if (!s) return null
  return <span data-testid={testid}>{t('ppCountdown', { t: s })}</span>
}

function durLabel(p: PostPassConfig, t: ReturnType<typeof useT>) {
  const d = postPassDuration(p)
  return d.unit === 'days' ? t('ppDurDays', { n: d.n }) : t('ppDurHours', { n: d.n })
}

export function PostPassButtons({ post, onDone }: { post?: number; onDone?: () => void }) {
  const t = useT()
  const toast = useApp((s) => s.showToast)
  const user = useApp((s) => s.user)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pickSku, setPickSku] = useState<PostPassId | null>(null)

  const buy = async (sku: PostPassId, posts: number[]) => {
    setErr(null)
    if (isLive && !user) { toast(t('signInToBuy')); return }
    setBusy(sku)
    try {
      const r = await buyPostPass(sku, posts)
      if (r === 'demo') toast(`${t('demo')} · ${t('ppDone')}`)
      else if (r === 'paid') toast(t('ppDone'))
      if (r !== 'dismissed') onDone?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('payFailed'))
    } finally { setBusy(null) }
  }

  const choose = (sku: PostPassId) => {
    if (sku === 'post_1' && !post) { setPickSku(sku); return }
    return void buy(sku, post ? (sku === 'post_1' ? [post] : [post]) : [])
  }

  return (
    <div className="space-y-2" data-testid="post-passes">
      {POST_PASSES.map((p) => (
        <Button
          key={p.id}
          variant={p.id === 'post_30' ? 'gold' : 'outline'}
          className="w-full !h-auto !min-h-11 !py-2.5"
          disabled={!!busy}
          onClick={() => choose(p.id)}
          data-testid={`buy-${p.id}`}
        >
          <Lock size={14} />
          <span className="flex min-w-0 flex-1 flex-col items-start text-left">
            <span className="font-bold">{t(p.posts === 1 ? 'ppBuy1' : 'ppBuyN', { n: p.posts, p: p.priceInr, d: durLabel(p, t) })}{!isLive ? ` · ${t('demo')}` : ''}</span>
            <span className="text-[11px] font-medium opacity-80">
              {post
                ? (p.posts === 1 ? t('ppThisPost', { n: post }) : t('ppThisPlus', { n: post, k: p.posts - 1 }))
                : (p.posts === 1 ? t('ppPickOne') : t('ppPickLater', { n: p.posts }))}
            </span>
          </span>
        </Button>
      ))}
      <p className="text-center text-[11.5px] leading-snug text-dim">{t('ppViewOnly')}</p>
      {!isLive && <p className="text-center text-[11px] text-gold">{t('ppDemoNote')}</p>}
      {err && <p className="rounded-xl border border-bad/30 bg-bad/[0.08] px-3 py-2 text-[12.5px] text-bad">{err}</p>}
      <PostPicker
        open={!!pickSku}
        duration={pickSku ? durLabel(POST_PASS_BY_ID[pickSku], t) : ''}
        onClose={() => setPickSku(null)}
        onPick={(n) => { const sku = pickSku; setPickSku(null); if (sku) void buy(sku, [n]) }}
      />
    </div>
  )
}

function PostPicker({ open, duration, onClose, onPick }: { open: boolean; duration: string; onClose: () => void; onPick: (n: number) => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const { data, loading } = useKnowledge()
  const posts = visiblePosts(data)
  return (
    <Sheet open={open} onClose={onClose} title={t('ppPickTitle')}>
      <p className="mb-3 text-[12.5px] leading-snug text-muted">{t('ppPickSub', { d: duration })}</p>
      {loading && <p className="text-[13px] text-muted">…</p>}
      {!loading && !posts.length && <p className="text-[13px] text-muted">{t('kNoPosts')}</p>}
      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto" data-testid="pp-picker">
        {posts.map((p: KPost) => (
          <button
            key={p.id}
            type="button"
            data-testid={`pp-pick-${p.number}`}
            onClick={() => onPick(p.number)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left hover:border-cyan/30"
          >
            <span className="font-mono text-[12px] font-bold text-cyan">#{p.number}</span>
            <span className="min-w-0 truncate text-[13.5px] font-semibold">{postTitle(p, lang)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export function ActivePassList() {
  usePostPasses((s) => s.passes)
  const list = activePasses()
  if (!list.length) return null
  return (
    <div className="mt-3 space-y-2" data-testid="pp-active">
      {list.map((p) => <ActiveRow key={p.id} p={p} />)}
    </div>
  )
}

function ActiveRow({ p }: { p: UserPostPass }) {
  const t = useT()
  const cap = capacityOf(p.type)
  const left = Math.max(0, cap - p.postIds.length)
  const list = p.postIds.map((n) => `#${n}`).join(', ')
  const cfg = POST_PASS_BY_ID[p.type]
  return (
    <div className="rounded-xl border border-cyan/25 bg-cyan/[0.05] px-3 py-2.5 text-[12.5px] leading-snug">
      <div className="flex items-center gap-1.5 font-semibold text-cyan">
        <Clock size={13} />
        <span>{t(cap === 1 ? 'ppBuy1' : 'ppBuyN', { n: cap, p: cfg.priceInr, d: durLabel(cfg, t) })}</span>
        <span className="ml-auto font-mono text-[11.5px]"><Remain until={p.expiresAt} /></span>
      </div>
      <div className="mt-1 text-muted">{t('ppSlots', { u: p.postIds.length, n: cap })}</div>
      {list ? <div className="mt-0.5 text-muted">{t('ppUsedPosts', { list })}</div> : null}
      {left > 0 && <div className="mt-0.5 text-cyan">{t('ppSlotsLeft', { n: left })}</div>}
    </div>
  )
}

export function PostPassBanner({ post }: { post: number }) {
  const t = useT()
  usePostPasses((s) => s.passes)
  const acc = postAccess(post)
  if (!acc.open || !acc.until) return null
  return (
    <div data-testid="pp-banner" className="flex items-start gap-2 rounded-2xl border border-cyan/30 bg-cyan/[0.07] p-3 text-[12.5px] leading-snug text-cyan">
      <Clock size={15} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">{t('ppBanner', { t: formatRemain(acc.until) ?? '—' })}</div>
        <p className="mt-0.5 text-[11.5px] text-cyan/80">{t('ppViewOnly')}</p>
      </div>
    </div>
  )
}

export function useSlotCount() {
  usePostPasses((s) => s.passes)
  return totalOpenSlots()
}

export function useOpenUntil(post: number) {
  usePostPasses((s) => s.passes)
  return postAccess(post)
}
