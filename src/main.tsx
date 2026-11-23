import './lib/betaIsolation'
import './lib/appMode'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BetaBadge } from './components/BetaBadge'
import { initAuth } from './lib/cloud'
import { captureReferralFromUrl } from './lib/referral'
import { trackInstall } from './lib/analytics'

captureReferralFromUrl()
trackInstall()
void initAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <BetaBadge />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // updateViaCache 'none' + update(): a returning visitor always checks for a new sw.js, so a new release
    // (new VERSION) replaces the old app-shell cache on the next refresh.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((reg) => reg.update().catch(() => {}))
      .catch((e) => console.warn('[sw]', e))
  })
}
