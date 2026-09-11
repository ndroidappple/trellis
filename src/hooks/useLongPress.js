import { useCallback, useEffect, useRef } from 'react'

/**
 * How long a press has to last before it stops being a tap.
 *
 * 650ms is the figure the board has used for the settings gesture since it
 * existed. Keeping one number means a hold that opens settings and a hold that
 * opens a meal feel like the same gesture rather than two gestures that happen
 * to look alike.
 */
export const LONG_PRESS_MS = 650

/**
 * How far a finger may drift and still count as a hold rather than a drag.
 *
 * A fingertip resting on glass emits a steady dribble of pointermove events,
 * so "did not move at all" is not a test any real touch passes. This is the
 * same 12px `TAP_SLOP_PX` uses in RecipeBook and for the same reason.
 */
export const LONG_PRESS_SLOP_PX = 12

/**
 * Hold a thing to manage it.
 *
 * The board's content is all primary-action-first: tapping a meal opens the
 * recipe, tapping a chore ticks it, tapping a day opens the day. That is the
 * right default — it is what you want nine times out of ten — but it left the
 * tenth thing with nowhere to live except a longer route through a sheet.
 * This is that tenth thing: the same object, the management view of it.
 *
 * ── Two details that are easy to get wrong ──
 *
 * **A long press still ends in a click.** The browser fires one when the
 * finger lifts, regardless of how long it was down, so without `consumeClick`
 * holding a meal chip opens the meal editor *and* the recipe behind it. The
 * flag is read-and-clear rather than a piece of state because it has to be
 * true for exactly one click and there is no render in between.
 *
 * **Cancel on scroll, not just on drag.** The week scrolls under the finger,
 * and a hold that survives a scroll fires a management sheet at someone who
 * was only moving the page. `pointercancel` covers the browser taking over the
 * gesture; the slop check covers the part before it decides to.
 */
export function useLongPress(onLongPress, { ms = LONG_PRESS_MS, enabled = true } = {}) {
  const timer = useRef(null)
  const origin = useRef(null)
  const fired = useRef(false)
  // Held in a ref so the handlers below never need rebuilding when the
  // callback identity changes, which for a chip in a list is every render.
  // Written in an effect rather than during render: the value is only ever
  // read from a pointer handler, which cannot run before the effect has.
  const callback = useRef(onLongPress)
  useEffect(() => {
    callback.current = onLongPress
  })

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled || !callback.current) return
      // Secondary buttons and stylus barrels open context menus of their own.
      if (e.button != null && e.button !== 0) return

      origin.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        fired.current = true
        callback.current?.()
        cancel()
      }, ms)
    },
    [cancel, enabled, ms]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!origin.current) return
      const { x, y } = origin.current
      if (Math.hypot(e.clientX - x, e.clientY - y) > LONG_PRESS_SLOP_PX) cancel()
    },
    [cancel]
  )

  /**
   * True exactly once, if a hold just fired. Call it at the top of the click
   * handler and bail when it returns true.
   */
  const consumeClick = useCallback(() => {
    if (!fired.current) return false
    fired.current = false
    return true
  }, [])

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    },
    consumeClick,
  }
}
