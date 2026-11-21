import { IS_BETA } from '../lib/betaIsolation'
import { APP_VERSION } from '../lib/env'
/** small fixed tag so a beta build is never mistaken for the live app */
export function BetaBadge() {
  if (!IS_BETA) return null
  return <div className="pointer-events-none fixed right-2 top-2 z-[9999] rounded-md bg-[linear-gradient(90deg,#22d3ee,#a78bfa)] px-2 py-0.5 font-mono text-[10px] font-bold text-[#04060c]" data-testid="beta-badge">BETA v{APP_VERSION}</div>
}
