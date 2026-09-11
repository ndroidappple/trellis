import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * How often the idle check runs. Not the timeout — the *resolution* of it.
 *
 * The timeout itself is never a `setTimeout`, because timers do not survive an
 * iPad suspending: a ten-minute timer set at 21:50 on a device that sleeps at
 * 21:52 fires whenever the hardware feels like it, which on this wall has
 * meant hours late. So the last touch is a timestamp and this interval simply
 * asks how long ago it was, the same shape as the midnight rollover in
 * `useToday`. A tick that arrives late has cost nothing: it compares against a
 * fresh `Date.now()` and gets the right answer anyway.
 *
 * Fifteen seconds is well under any offered timeout and cheap enough to run
 * for weeks — one comparison, no allocation, no render unless the answer
 * changed.
 */
const TICK_MS = 15_000

/**
 * The events that count as someone being there.
 *
 * Listened for on `window` in the capture phase so a tap on a control still
 * counts — the control stops the bubble, not the capture, and a person ticking
 * chores is unambiguously present. Passive, because none of this may ever
 * delay a scroll.
 *
 * `pointerdown` covers touch, pen and mouse in one. `keydown` is here for a
 * keyboard, and `wheel` for a trackpad — someone reading a long shopping list
 * by scrolling is interacting even though they never press anything.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel']

/**
 * Whether nobody has touched this screen for a while.
 *
 * `timeoutMs` of null means never go idle, which is how "Never" and a setting
 * the app could not parse both arrive here.
 *
 * `enabled` is separate from the timeout on purpose: it is for the moments the
 * screen must stay up regardless of the clock — cook mode being the whole
 * reason it exists — and turning it off wakes immediately rather than leaving
 * a suspended countdown to surprise someone later.
 */
export function useIdle({ timeoutMs, enabled = true }) {
  const [idle, setIdle] = useState(false)

  /**
   * When someone was last here, as a timestamp.
   *
   * Seeded in the effect rather than at `useRef(Date.now())`, so the clock is
   * never read during render — and because the countdown should start when the
   * timer starts, not when the component first mounted. Those differ whenever
   * the feature is re-enabled: stepping out of cook mode after an hour should
   * give you the full timeout again, not fade the moment you look away.
   */
  const lastActivity = useRef(0)

  /**
   * Whether sleep was asked for rather than waited out.
   *
   * **This is what kept "Sleep now" from working.** The button is a tap, the
   * tap runs `markActive` on the way past, and `lastActivity` therefore says
   * somebody was here a quarter of a second ago. The tick below then asked its
   * one question — has it been quiet for long enough? — got "no", and switched
   * the screensaver back off within fifteen seconds of it appearing, with
   * nobody having touched anything. The board looked like it could not stay
   * asleep.
   *
   * A flag rather than backdating `lastActivity` by the timeout, because that
   * trick has no answer for a household set to "Never": there is no timeout to
   * subtract, and sending the wall to sleep by hand has to work there too —
   * arguably it matters most there.
   */
  const forced = useRef(false)

  const wake = useCallback(() => {
    forced.current = false
    lastActivity.current = Date.now()
    setIdle(false)
  }, [])

  /**
   * Go to sleep now, without waiting out the timeout.
   *
   * Waking is deliberately *not* given a matching manual path: it stays "any
   * touch", the same as a timed sleep, so there is only ever one thing to know
   * about getting the board back. A button that put the wall to sleep and then
   * needed a different gesture to undo would be two mechanisms where the
   * feature already has one that works.
   */
  const sleep = useCallback(() => {
    forced.current = true
    setIdle(true)
  }, [])

  useEffect(() => {
    if (!enabled) {
      // Both the flag and the clock have to clear the state, not just stop
      // feeding it. Cook mode opening while the wall is already asleep must
      // put the recipe on screen, not queue it behind the next touch — and
      // that outranks having been sent to sleep by hand.
      forced.current = false
      setIdle(false)
      lastActivity.current = Date.now()
      return
    }

    // "Never" means never go idle *on its own*. A hand-sent sleep still
    // stands, and nothing here is running to undo it.
    if (timeoutMs == null) {
      lastActivity.current = Date.now()
      return
    }

    lastActivity.current = Date.now()

    function markActive() {
      lastActivity.current = Date.now()
      // A hand-sent sleep lasts until somebody is actually here, at which
      // point it stops being special and the ordinary countdown resumes.
      forced.current = false
      // Deliberately does not clear `idle`. Dismissing the screensaver is the
      // overlay's job, because it has to swallow that touch first; if this
      // cleared the flag the board would be back under the finger before the
      // tap it arrived on had finished landing.
    }

    function onVisible() {
      if (document.visibilityState !== 'visible') return
      // A wake is a fresh start, not a resumed countdown. Coming back to a
      // board that fades out four seconds later — because the timer had been
      // most of the way through when the iPad slept — reads as a fault.
      wake()
    }

    const tick = setInterval(() => {
      setIdle(forced.current || Date.now() - lastActivity.current >= timeoutMs)
    }, TICK_MS)

    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, markActive, { capture: true, passive: true })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(tick)
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, markActive, { capture: true })
      }
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, timeoutMs, wake])

  return { idle, wake, sleep }
}
