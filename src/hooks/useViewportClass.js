import { useState, useEffect } from 'react'

/**
 * 'wall' (iPad-or-larger, the primary always-on surface) vs. 'phone' (a
 * secondary "quick check" screen — see CLAUDE.md's framing). Didn't exist
 * before the widget home screen: `useOrientation` answers a different
 * question (which way is this screen turned) and says nothing about how
 * big it is, and nothing else in the app has needed a device-class split
 * until now — the widget grid is the first thing where a phone genuinely
 * cannot host the same layout as the wall, not just a smaller version of it
 * (see the widget-home-screen plan's "Sync scope" section).
 *
 * `min(innerWidth, innerHeight)` is the signal, not `innerWidth` alone,
 * because a landscape phone's width alone can exceed an iPad's *portrait*
 * width (e.g. a large iPhone in landscape is wider than this iPad is tall
 * in portrait) — the smaller of the two axes is what stays small on a phone
 * in either orientation, and stays >= 600 on this iPad in either
 * orientation too (portrait 834pt+, landscape 834pt). Expressed as a single
 * compound media query — `(min-width) and (min-height)` both holding is
 * exactly `min(width, height) >= 600` — so this can reuse `useOrientation`'s
 * own matchMedia-plus-`change`-listener shape rather than a ResizeObserver:
 * a device class is a coarse boolean, not a continuous measurement.
 */
const QUERY = '(min-width: 600px) and (min-height: 600px)'

export function useViewportClass() {
  const [viewportClass, setViewportClass] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? 'wall'
      : window.matchMedia(QUERY).matches
        ? 'wall'
        : 'phone'
  )

  useEffect(() => {
    if (!window.matchMedia) return

    const mql = window.matchMedia(QUERY)
    const sync = () => setViewportClass(mql.matches ? 'wall' : 'phone')

    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  return viewportClass
}
