import { useState, useEffect } from 'react'

/**
 * Reports whether the device is currently portrait or landscape, and stays
 * current when it changes — the iPad now sits on a magnetic counter dock
 * instead of a fixed wall mount, so unlike the old build, orientation is no
 * longer a constant chosen once at design time.
 *
 * `matchMedia('(orientation: …)')` fires its `change` listener on an actual
 * device rotation and on a desktop browser window resize alike, which is
 * what makes it usable for local testing (resize the window) as well as on
 * the iPad itself. Read once for the initial render rather than defaulting
 * to 'portrait' and correcting after mount, so the very first frame already
 * matches reality instead of flashing the wrong layout for one tick.
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? 'portrait'
      : window.matchMedia('(orientation: landscape)').matches
        ? 'landscape'
        : 'portrait'
  )

  useEffect(() => {
    if (!window.matchMedia) return

    const mql = window.matchMedia('(orientation: landscape)')
    const sync = () => setOrientation(mql.matches ? 'landscape' : 'portrait')

    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  return orientation
}
