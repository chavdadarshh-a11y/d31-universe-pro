import { IS_PREVIEW } from '../lib/previewIsolation'
import { APP_VERSION } from '../lib/env'
/** small fixed tag so a preview build is never mistaken for the live app */
export function PreviewBadge() {
  if (!IS_PREVIEW) return null
  return <div className="pointer-events-none fixed left-2 top-2 z-[9999] rounded-md bg-fuchsia-600/90 px-2 py-0.5 font-mono text-[10px] font-bold text-white" data-testid="preview-badge">PREVIEW v{APP_VERSION}</div>
}
