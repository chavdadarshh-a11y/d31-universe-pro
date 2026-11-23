import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onValue: (v: string) => void; wrapClass?: string; testid?: string; clearLabel?: string }

/**
 * The one search box used everywhere: a fully transparent glass pill with a thin base line and a light that travels
 * clockwise around the outline every 4 s. The border light uses the same white → gold → cyan as the inner caret
 * "flash light" (NeonInputs beam), so the two match. Reduced motion → a static soft gradient outline.
 */
export const SearchBox = forwardRef<HTMLInputElement, Props>(function SearchBox({ value, onValue, wrapClass = '', testid, clearLabel = 'Clear', className = '', ...rest }, ref) {
  return (
    <div className={`sbx ${value ? 'has-value' : ''} ${wrapClass}`} data-testid={testid ? `${testid}-box` : 'search-box'}>
      <span className="sbx-ring" aria-hidden><i /></span>
      <span className="sbx-glow" aria-hidden><i /></span>
      <Search size={16} className="sbx-icon" aria-hidden />
      <input ref={ref} type="search" autoComplete="off" spellCheck={false} {...rest} data-testid={testid} value={value} onChange={(e) => onValue(e.target.value)} className={`sbx-in ${className}`} />
      {value && <button type="button" className="sbx-x" aria-label={clearLabel} onMouseDown={(e) => e.preventDefault()} onClick={() => onValue('')}><X size={15} /></button>}
    </div>
  )
})
