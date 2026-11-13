import { Compass } from 'lucide-react'
import { useT } from '../i18n'
import { Button } from '../components/ui'
import { navigate } from '../lib/router'

export function NotFound() {
  const t = useT()
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center" data-testid="not-found">
      <div className="readout text-[64px] font-extrabold text-cyan">404</div>
      <Compass size={30} className="mt-2 text-gold" />
      <h1 className="title-hud mt-3 text-[18px]">{t('nfTitle')}</h1>
      <p className="mt-2 max-w-[280px] text-[13.5px] text-muted">{t('nfSub')}</p>
      <Button className="mt-6" onClick={() => navigate('/home')}>{t('nfHome')}</Button>
    </div>
  )
}
