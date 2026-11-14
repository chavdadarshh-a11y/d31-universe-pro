import { useEffect, useState } from 'react'
import { Clock, Lock, Ticket } from 'lucide-react'
import { useApp, effectivePlan } from '../store/app'
import { useT } from '../i18n'
import { Badge, Button, Sheet } from './ui'
import { IN_APP } from '../lib/appMode'
import { isLive } from '../lib/env'
import { POST_PASSES, POST_PASS_BY_ID, postPassDuration, type PostPassId, type PostPassConfig } from '../config/plans'
import {
  activeUnlocks, buyPostPass, creditsByType, creditsLeft, formatRemain, postAccess,
  usePostPasses, type PortalUnlock,
} from '../lib/postPasses'
import { trustedNow } from '../lib/plans'
import { postTitle, useKnowledge, visiblePosts, type KPost } from '../lib/knowledge'
import { useWallet } from '../lib/wallet'
import { Switch } from './Switch'
import { navigate } from '../lib/router'

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

export function WalletPayToggle({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  const t = useT()
  const bal = useWallet((s) => s.balance)
  if (IN_APP || bal <= 0) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan/25 bg-cyan/[0.05] px-3 py-2" data-testid="wallet-toggle">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{t('useWallet', { n: bal })}</div>
        {on && <div className="text-[11px] text-muted">{t('walletApplied', { n: bal })}</div>}
      </div>
      <Switch on={on} onChange={setOn} label={t('useWallet', { n: bal })} testid="wallet-on" />
    </div>
  )
}

export function CreditBalance() {
  const t = useT()
  usePostPasses((s) => s.lots)
  const total = creditsLeft()
  const by = creditsByType()
  return (
    <div className="rounded-xl border border-cyan/25 bg-cyan/[0.05] px-3 py-2.5" data-testid="pp-credits">
      <div className="flex items-center gap-1.5 font-semibold text-cyan">
        <Ticket size={14} />
        <span>{t(total === 0 ? 'ppCreditBal0' : total === 1 ? 'ppCreditBal1' : 'ppCreditBalN', { n: total })}</span>
      </div>
      {by.some((x) => x.left > 0) && (
        <ul className="mt-1.5 space-y-0.5 text-[12px] text-muted">
          {by.filter((x) => x.left > 0).map((x) => {
            const cfg = POST_PASS_BY_ID[x.type]
            return <li key={x.type} data-testid={`pp-credit-${x.type}`}>{t(x.left === 1 ? 'ppCreditLine1' : 'ppCreditLineN', { name: cfg.name, n: x.left, d: durLabel(cfg, t) })}</li>
          })}
        </ul>
      )}
    </div>
  )
}

export function PostPassButtons({ post, onDone }: { post?: number; onDone?: () => void }) {
  const t = useT()
  const toast = useApp((s) => s.showToast)
  const user = useApp((s) => s.user)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pick, setPick] = useState(false)
  const [wallet, setWallet] = useState(true)
  usePostPasses((s) => s.lots)
  const left = creditsLeft()

  const buy = async (sku: PostPassId, posts: number[]) => {
    setErr(null)
    if (isLive && !user) { toast(t('signInToBuy')); return }
    setBusy(sku)
    try {
      const r = await buyPostPass(sku, posts, { wallet })
      if (r === 'demo') toast(`${t('demo')} · ${t('ppDone')}`)
      else if (r === 'paid') toast(t('ppDone'))
      if (r !== 'dismissed') onDone?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('payFailed'))
    } finally { setBusy(null) }
  }

  const spend = async (posts: number[]) => {
    for (const n of posts) {
      const r = await usePostPasses.getState().claim(n)
      if (r === 'none') toast(t('ppNeedPost'))
      else if (r === 'claimed') toast(t('ppClaimed'))
    }
    onDone?.()
  }

  const openThis = async () => {
    if (!post) { setPick(true); return }
    if (left > 0) {
      const r = await usePostPasses.getState().claim(post)
      if (r === 'none') toast(t('ppNeedPost'))
      else { toast(t('ppClaimed')); onDone?.() }
      return
    }
    setPick(true)
  }

  return (
    <div className="space-y-2" data-testid="post-passes">
      <CreditBalance />
      {left > 0 && (
        <Button variant="outline" className="w-full" data-testid="pp-pick-open" onClick={() => void openThis()}>
          {post ? t('ppClaim', { n: left }) : t('ppPickCredits')}
        </Button>
      )}
      <WalletPayToggle on={wallet} setOn={setWallet} />
      {POST_PASSES.map((p) => (
        <Button
          key={p.id}
          variant={p.id === 'post_30' ? 'gold' : 'outline'}
          className="w-full !h-auto !min-h-11 !py-2.5"
          disabled={!!busy}
          onClick={() => void buy(p.id, post ? [post] : [])}
          data-testid={`buy-${p.id}`}
        >
          <Lock size={14} className="shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col items-start text-left">
            <span className="flex flex-wrap items-center gap-1.5 font-bold">
              <span>{p.name} · ₹{p.priceInr}</span>
              {!isLive && <Badge tone="gold">{t('demo')}</Badge>}
            </span>
            <span className="text-[11px] font-medium opacity-80">
              {t(p.posts === 1 ? 'ppOffer1' : 'ppOfferN', { n: p.posts, d: durLabel(p, t) })}
              {' · '}
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
        open={pick}
        max={Math.max(1, left)}
        onClose={() => setPick(false)}
        onPick={(nums) => { setPick(false); void spend(nums) }}
      />
    </div>
  )
}

function PostPicker({ open, max, onClose, onPick }: { open: boolean; max: number; onClose: () => void; onPick: (n: number[]) => void }) {
  const t = useT()
  const lang = useApp((s) => s.lang)
  const { data, loading } = useKnowledge()
  const posts = visiblePosts(data)
  const [sel, setSel] = useState<number[]>([])
  useEffect(() => { if (open) setSel([]) }, [open])
  const toggle = (n: number) => setSel((cur) => cur.includes(n) ? cur.filter((x) => x !== n) : cur.length < max ? [...cur, n] : cur)
  const n = sel.length
  return (
    <Sheet open={open} onClose={onClose} title={t('ppPickCredits')}>
      <p className="mb-3 text-[12.5px] leading-snug text-muted">
        {t('ppPickSub')}
        <span className="mt-1 block font-medium text-frost">{t('ppPickCount', { n, m: max })}</span>
      </p>
      {loading && <p className="text-[13px] text-muted">…</p>}
      {!loading && !posts.length && <p className="text-[13px] text-muted">{t('kNoPosts')}</p>}
      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto" data-testid="pp-picker">
        {posts.map((p: KPost) => {
          const on = sel.includes(p.number)
          const acc = postAccess(p.number)
          return (
            <button
              key={p.id}
              type="button"
              data-testid={`pp-pick-${p.number}`}
              onClick={() => !acc.open && toggle(p.number)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${on ? 'border-cyan/50 bg-cyan/[0.07]' : 'border-white/10 hover:border-cyan/30'} ${acc.open ? 'opacity-60' : ''}`}
            >
              <span className="font-mono text-[12px] font-bold text-cyan">#{p.number}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{postTitle(p, lang)}</span>
              {acc.open && acc.until && <span className="font-mono text-[11px] text-cyan"><Remain until={acc.until} testid={`pp-pick-timer-${p.number}`} /></span>}
            </button>
          )
        })}
      </div>
      <Button className="mt-3 w-full" disabled={!sel.length} data-testid="pp-pick-confirm" onClick={() => onPick(sel)}>{t(n === 1 ? 'ppUnlockWith1' : 'ppUnlockWithN', { n })}</Button>
    </Sheet>
  )
}

export function ActiveUnlockList() {
  usePostPasses((s) => s.unlocks)
  const list = activeUnlocks()
  if (!list.length) return null
  return (
    <div className="mt-3 space-y-2" data-testid="pp-active">
      {list.map((u) => <UnlockRow key={u.id} u={u} />)}
    </div>
  )
}

/** @deprecated use ActiveUnlockList */
export function ActivePassList() {
  return <ActiveUnlockList />
}

function UnlockRow({ u }: { u: PortalUnlock }) {
  const lang = useApp((s) => s.lang)
  const { data } = useKnowledge()
  const post = visiblePosts(data).find((p) => p.number === u.postNumber)
  return (
    <div className="rounded-xl border border-cyan/25 bg-cyan/[0.05] px-3 py-2.5 text-[12.5px] leading-snug" data-testid={`pp-unlock-${u.postNumber}`}>
      <div className="flex items-center gap-1.5 font-semibold text-cyan">
        <Clock size={13} />
        <span className="min-w-0 truncate">#{u.postNumber}{post ? ` · ${postTitle(post, lang)}` : ''}</span>
        <span className="ml-auto shrink-0 font-mono text-[11.5px]"><Remain until={u.expiresAt} testid={`pp-timer-${u.postNumber}`} /></span>
      </div>
    </div>
  )
}

export function PostPassBanner({ post }: { post: number }) {
  const t = useT()
  usePostPasses((s) => s.unlocks)
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
  usePostPasses((s) => s.lots)
  return creditsLeft()
}

export function useOpenUntil(post: number) {
  usePostPasses((s) => s.unlocks)
  return postAccess(post)
}

export function useUpgradeNudge() {
  const plan = effectivePlan(useApp((s) => s.membership))
  usePostPasses((s) => s.lots)
  usePostPasses((s) => s.unlocks)
  const spent = usePostPasses.getState().lots.reduce((n, l) => n + Math.max(0, l.credits - l.remaining), 0)
  const unlocked = activeUnlocks().length
  const many = spent >= 2 || unlocked >= 2
  if (plan === 'platinum') return null
  if (plan === 'gold') return 'nudgeGoldPlat' as const
  if (plan === 'pro') return many ? 'nudgeProGold' as const : null
  if (plan === 'free' && many) return 'nudgeFreeGold' as const
  if (plan === 'free') return 'nudgeFreePro' as const
  return null
}

export function UpgradeNudge() {
  const t = useT()
  const key = useUpgradeNudge()
  if (!key) return null
  return (
    <button type="button" data-testid="upgrade-nudge" onClick={() => navigate('/membership')} className="mt-3 block w-full rounded-2xl border border-gold/30 bg-gold/[0.06] p-3 text-left text-[13px] leading-snug text-gold">
      {t(key)}
    </button>
  )
}
