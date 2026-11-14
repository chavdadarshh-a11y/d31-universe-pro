import { useState } from 'react'
import { Copy, Share2, Ticket, Users } from 'lucide-react'
import { useT } from '../i18n'
import { Button, Header } from '../components/ui'
import { IN_APP } from '../lib/appMode'
import { REFERRAL } from '../config/plans'
import { referralUrl, useReferral } from '../lib/referral'
import { useWallet } from '../lib/wallet'

export function Referral() {
  const t = useT()
  const stats = useReferral((s) => s.stats)
  const bal = useWallet((s) => s.balance)
  const [copied, setCopied] = useState(false)
  const link = stats.code ? referralUrl(stats.code) : ''

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }
  const share = async () => {
    if (!link) return
    try {
      if (navigator.share) await navigator.share({ title: 'D31.UNIVERSE', url: link, text: t('refTitle') })
      else await copy()
    } catch { /* dismissed */ }
  }

  return (
    <div>
      <Header title={t('refTitle')} back />
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan/12 text-cyan"><Users size={26} /></span>
        <h1 className="mt-3 text-[24px] font-extrabold tracking-tight">{t('refTitle')}</h1>
        {!IN_APP && <p className="mt-1 text-[13px] leading-snug text-muted">{t('refSub', { n: REFERRAL.rewardInr, m: REFERRAL.maxPerMember })}</p>}
      </div>

      {!IN_APP && (
        <div className="card mt-4 flex items-center gap-3 p-4" data-testid="wallet-balance">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/12 text-gold"><Ticket size={18} /></span>
          <div>
            <div className="label">{t('walletBal', { n: bal })}</div>
            <p className="text-[12px] text-muted">{t('creditPolicy')}</p>
          </div>
        </div>
      )}

      {stats.code && (
        <div className="card mt-3 p-4" data-testid="ref-link">
          <div className="label">{t('refShare')}</div>
          <div className="mt-2 break-all rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[12.5px]">{link}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => void copy()} data-testid="ref-copy"><Copy size={14} /> {copied ? t('refCopied') : t('refCopy')}</Button>
            <Button size="sm" onClick={() => void share()} data-testid="ref-share"><Share2 size={14} /> {t('refShare')}</Button>
          </div>
        </div>
      )}

      {!IN_APP && (
        <div className="mt-3 text-center text-[13px] text-muted" data-testid="ref-stats">
          {stats.rewarded > 0 ? t('refStats', { n: stats.rewarded, m: stats.max }) : t('refNone')}
        </div>
      )}
    </div>
  )
}

