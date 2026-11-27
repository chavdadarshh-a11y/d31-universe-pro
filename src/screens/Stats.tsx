import { useEffect, useState } from 'react'
import { Lock, Users, Eye, UserCheck, ListChecks } from 'lucide-react'
import { Header, Card } from '../components/ui'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { isOwner } from '../lib/owner'
import { fetchOwnerStats, type OwnerStats } from '../lib/analytics'
import { navigate } from '../lib/router'
import { NotFound } from './NotFound'

function Stat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan/10 text-cyan">{icon}</span>
      <span>
        <span className="block font-mono text-[20px] font-extrabold tabular-nums">{value}</span>
        <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      </span>
    </Card>
  )
}

export function Stats() {
  const t = useT()
  const user = useApp((s) => s.user)
  const [data, setData] = useState<OwnerStats | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/auth?next=/stats')
      return
    }
    if (!isOwner(user)) return
    void fetchOwnerStats().then(setData)
  }, [user])

  if (!user) return null
  if (!isOwner(user)) return <NotFound />

  const maxV = Math.max(1, ...(data?.daily.map((d) => d.visitors) ?? [1]))

  return (
    <div data-testid="owner-stats">
      <Header title={t('statsTitle')} sub={t('statsSub')} back="/settings" />
      {data && data.source === 'local' && (
        <p className="mt-3 rounded-2xl border border-gold/35 bg-gold/[0.07] p-3 text-[13px] leading-snug text-gold" data-testid="stats-not-live">
          {t('statsNotLive')}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label={t('statsPageViews')} value={data?.totals.pageViews ?? '—'} icon={<Eye size={18} />} />
        <Stat label={t('statsVisitors')} value={data?.totals.uniqueVisitors ?? '—'} icon={<Users size={18} />} />
        <Stat label={t('statsSignedUp')} value={data?.totals.signedUp ?? '—'} icon={<UserCheck size={18} />} />
        <Stat label={t('statsWaitlist')} value={data?.totals.waitlist ?? '—'} icon={<ListChecks size={18} />} />
      </div>
      {data?.source === 'local' && <p className="mt-2 font-mono text-[11px] text-dim">{t('statsThisDevice')}</p>}

      <h2 className="label mt-5">{t('statsDaily')}</h2>
      <Card className="mt-2 p-3" data-testid="stats-daily">
        {data?.daily.length ? (
          <div className="flex h-28 items-end gap-1">
            {data.daily.map((d) => (
              <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-cyan/80" style={{ height: `${Math.max(6, (d.visitors / maxV) * 100)}%` }} title={`${d.day}: ${d.visitors}`} />
                <span className="font-mono text-[8px] text-dim">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-[13px] text-muted">{t('noPagesYet')}</p>}
      </Card>

      <h2 className="label mt-5">{t('statsTopPages')}</h2>
      <Card className="mt-2 divide-y divide-white/[0.05] p-0" data-testid="stats-pages">
        {data?.topPages.length ? data.topPages.map((p) => (
          <div key={p.path} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="truncate font-mono text-[12px]">{p.path}</span>
            <span className="font-mono text-[12px] font-bold text-cyan">{p.views}</span>
          </div>
        )) : <p className="p-3 text-[13px] text-muted">{t('noPagesYet')}</p>}
      </Card>

      <h2 className="label mt-5">{t('statsUsers')}</h2>
      <Card className="mt-2 divide-y divide-white/[0.05] p-0" data-testid="stats-users">
        {data?.users.length ? data.users.map((u) => (
          <div key={u.id} className="px-3 py-2.5">
            <div className="truncate text-[13.5px] font-semibold">{u.email || u.name || u.id}</div>
            <div className="mt-0.5 font-mono text-[11px] text-dim">{u.name}{u.lastSeen ? ` · ${u.lastSeen.slice(0, 10)}` : ''}</div>
          </div>
        )) : <p className="p-3 text-[13px] text-muted">{t('noUsersYet')}</p>}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-[12px] leading-snug text-muted">
        <Lock size={14} className="mt-0.5 shrink-0" /> {t('statsAnonNote')}
      </p>
    </div>
  )
}
