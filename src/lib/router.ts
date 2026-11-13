import { useEffect, useState } from 'react'

export function parseHash(): string[] {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h.split('?')[0].split('/').filter(Boolean)
}

export function hashQuery(): URLSearchParams {
  const h = window.location.hash
  const i = h.indexOf('?')
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '')
}

export function navigate(path: string) {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : '/' + path}`
  if (window.location.hash !== target) window.location.hash = target
}

export function goBack(fallback = '/home') {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback)
}

export function useRoute(): string[] {
  const [parts, setParts] = useState(parseHash())
  useEffect(() => {
    const on = () => {
      setParts(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return parts
}
