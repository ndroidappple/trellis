import { useEffect, useState } from 'react'

/**
 * Promoted from the one-off copy in src/dev/gooey-spike.jsx (Phase 0) — now
 * a real dependency: tokens.css's --dur-* zeroing doesn't reach
 * liquid-gooey's own `transition` prop, so anywhere a `<Liquid.Item>` is
 * mounted has to check this explicitly and skip the effect rather than
 * trust the CSS media query to reach it.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
