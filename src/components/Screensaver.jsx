import { useEffect, useRef, useState } from 'react'
import './Screensaver.css'

/**
 * The face the wall wears most of the day.
 *
 * The board gets looked at a few dozen times a day; this is what the room sees
 * the rest of the time, which inverts the usual priority — the "idle" screen is
 * really the primary visual surface of the product, and it is doing two jobs
 * that a dimmed board would not do at all.
 *
 * **Image persistence.** A wall-mounted iPad shows the same grid in the same
 * pixels for weeks. The week rules, the panel edges and the header are static
 * geometry in fixed positions, which is the exact condition that burns a
 * screen. So *slow movement is a functional requirement, not a mood*, and
 * nothing in this scene may hold still: every layer here travels, and there is
 * deliberately no text, because text is the one thing that would sit in fixed
 * pixels and reintroduce the problem the scene exists to solve.
 *
 * **Light pollution.** An always-lit screen on the wall of a room people relax
 * in is a lamp nobody asked for, so the whole scene drops to a much darker,
 * slower variant at night (`night`), which the caller derives from the same
 * clock everything else in the app hangs off.
 *
 * It overlays the board rather than replacing it. Unmounting the board would
 * tear down five realtime subscriptions and the clock hook, and the wall would
 * come back showing a stale week — the exact failure the sync work went and
 * fixed.
 */
export default function Screensaver({ night, onWake }) {
  const [paused, setPaused] = useState(() => document.visibilityState !== 'visible')
  const wokenRef = useRef(false)

  /*
   * Stop animating entirely when nobody can see it.
   *
   * Browsers throttle offscreen animation but do not reliably stop it, and
   * this thing runs for hours a day on a device that must not get warm across
   * a multi-week uptime. Paused is also the correct state to *return* from:
   * the scene resumes where it left off rather than snapping to wherever the
   * timeline would have reached, so a wake never shows a jump.
   */
  useEffect(() => {
    function onVisibility() {
      setPaused(document.visibilityState !== 'visible')
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /**
   * Swallow the touch that wakes the wall.
   *
   * This is the same class of bug the long-press settings gesture already hit:
   * one touch that means something to the wall and something else to the
   * widget underneath it. Dismissing the screensaver must not also tick the
   * chore that happened to be under the finger — and "under the finger" is
   * likely, because the finger goes wherever the hand was, not wherever the
   * board is empty.
   *
   * `preventDefault` on the pointerdown suppresses the compatibility mouse
   * events on iOS, but a real click can still be synthesised, and by the time
   * it arrives this overlay has unmounted and the board is back under the
   * cursor. So the next click is caught at the window, in the capture phase,
   * before it can reach anything — and released on a timer in case the gesture
   * ends in no click at all, which a swipe or a cancelled touch does.
   */
  function handlePointerDown(e) {
    if (wokenRef.current) return
    wokenRef.current = true

    e.preventDefault()
    e.stopPropagation()

    function swallow(clickEvent) {
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      release()
    }

    function release() {
      clearTimeout(timer)
      window.removeEventListener('click', swallow, true)
    }

    const timer = setTimeout(release, 700)
    window.addEventListener('click', swallow, true)

    onWake()
  }

  return (
    <div
      className="saver"
      data-night={night ? 'true' : 'false'}
      data-paused={paused ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={0}
      aria-label="The board is resting. Touch anywhere to return to it."
    >
      {/*
        Four drifting fields of light and a wash that breathes underneath them.
        The numbers are in the stylesheet: every one is minutes long and the
        periods are mutually prime, so the layers never resynchronise into a
        repeating figure that the eye starts to expect — which is what makes
        this read as weather rather than as a loop.
      */}
      <div className="saver__wash" aria-hidden="true" />
      <div className="saver__drift saver__drift--a" aria-hidden="true" />
      <div className="saver__drift saver__drift--b" aria-hidden="true" />
      <div className="saver__drift saver__drift--c" aria-hidden="true" />
      <div className="saver__drift saver__drift--d" aria-hidden="true" />
    </div>
  )
}
