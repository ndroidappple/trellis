import { useEffect } from 'react'

/**
 * Drives the board's real height from window.visualViewport instead of
 * trusting 100dvh alone, and clears whatever scroll the keyboard leaves
 * behind once it closes.
 *
 * index.css already declares the rule this is patching a hole in: "the
 * window itself never scrolls... anything that makes the whole frame scroll
 * is a layout bug", enforced there with `overflow: hidden` on html and body.
 * That holds for rubber-banding and stray touch scrolls, but a focused text
 * field — AddRow's capture, the chore sheet, the event or meal editor — is a
 * hole in it: iOS's own "pan the visual viewport to keep the focused input
 * above the keyboard" behaviour operates beneath the CSS overflow model
 * entirely, so `overflow: hidden` never sees it and can't refuse it. On a
 * Home Screen web app (`display: standalone`, which is how this is meant to
 * run) `100dvh` has also not reliably shrunk to the keyboard-adjusted
 * visible area across iOS versions, so `.board` stays sized to a viewport
 * that no longer matches what's actually visible — the board ends up frozen
 * a keyboard's height too high, its own top edge panned past and clipped by
 * `.board-wrapper`'s overflow: hidden, with nothing about closing the
 * keyboard putting the pan back.
 *
 * `window.visualViewport` is the one thing iOS keeps accurate through all of
 * this — it's Apple's own documented answer to exactly this class of bug.
 * Mirroring its height onto `--app-height` (which Board.css prefers over
 * 100dvh) means the board actually shrinks to the visible area while the
 * keyboard is up, rather than staying full height and leaning on a pan to
 * make up the difference. And the moment the keyboard closes — visualViewport
 * height back to (approximately) window.innerHeight — is the one time a
 * stray scroll is worth clearing outright, since nothing in this app ever
 * has a legitimate reason to have scrolled the window at all.
 */
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const root = document.documentElement

    function sync() {
      root.style.setProperty('--app-height', `${vv.height}px`)

      const keyboardClosed = vv.height >= window.innerHeight - 1
      if (keyboardClosed && (window.scrollX !== 0 || window.scrollY !== 0)) {
        window.scrollTo(0, 0)
      }
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)

    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])
}
