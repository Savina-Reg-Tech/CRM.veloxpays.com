import { useEffect, useState } from 'react'

/** matchMedia with a change listener. Defaults to false where matchMedia is missing (tests, SSR). */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false)
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** ≥ lg (1024px): tables instead of cards. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
/** ≥ md (768px): drawers instead of full-screen sheets, inline filters instead of a bottom sheet. */
export const useIsTablet = () => useMediaQuery('(min-width: 768px)')
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
