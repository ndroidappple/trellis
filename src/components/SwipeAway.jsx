import { useCallback, useEffect, useRef, useState } from 'react'
import './SwipeAway.css'

/** How far left the finger must have travelled on release to commit. */
const COMMIT_PX = 96

/**
 * How far horizontal a drag must be before it is a swipe at all.
 *
 * Both numbers matter. `ENGAGE_PX` keeps a tap that wobbles from sliding the
 * row under the finger; the ratio keeps a diagonal scroll from being read as a
 * swipe. The panel this lives in scrolls vertically and is frequently read by
 * someone dragging a finger down it, so the failure that matters is a scroll
 * that peels rows open, not a swipe that needs repeating.
 */
const ENGAGE_PX = 12
const HORIZONTAL_BIAS = 1.4

/** The slide-out before the row is actually removed. Matches --dur-move. */
const EXIT_MS = 220

/**
 * Swipe a row left to delete it.
 *
 * Wraps a row rather than being built into one, because the three places this
 * is wanted — chores, shopping, the day sheet's tasks — have three different
 * row components and only this behaviour in common.
 *
 * ── Why a swipe is the right shape here ──
 *
 * Delete is a real action on these lists and it has never had a good home. The
 * shopping dock deliberately has none: a permanent 44px "×" beside the primary
 * tap is a mis-tap generator on a wall, for something done about once a month
 * (see `ShoppingAisles`). The chore row went the same way and moved delete into
 * a settings sheet two taps down. Both were the right call against the options
 * available, and both left the common case slow.
 *
 * A swipe costs no pixels at rest, sits nowhere near the tap target, and
 * cannot be triggered by the kind of imprecise press a wall attracts.
 *
 * ── What keeps it from eating scrolls ──
 *
 * `touch-action: pan-y` on the track is the load-bearing part: it hands
 * vertical panning to the browser and keeps horizontal for us, so the list
 * scrolls normally and neither gesture has to out-race the other. The
 * engagement test above is the second line of that defence for pointer
 * devices, where `touch-action` does nothing.
 *
 * ── And from deleting things by accident ──
 *
 * Nothing here is irreversible: every caller's handler already routes through
 * `offerUndo`, so a swipe lands the same nine-second undo a delete from a
 * sheet does. That is what makes the gesture affordable at all — a wall in a
 * kitchen gets brushed past.
 *
 * The old routes stay. The chore sheet still deletes, the shopping page keeps
 * its "×". A swipe is a keyboard-less, screen-reader-less gesture and cannot
 * be the only way to do anything.
 */
export default function SwipeAway({ onDelete, label = 'Delete', disabled = false, children }) {
  const [dx, setDx] = useState(0)
  const [exiting, setExiting] = useState(false)

  const origin = useRef(null)
  const engaged = useRef(false)
  const swallow = useRef(false)
  const exitTimer = useRef(null)

  useEffect(() => () => clearTimeout(exitTimer.current), [])

  const reset = useCallback(() => {
    origin.current = null
    engaged.current = false
    setDx(0)
  }, [])

  function onPointerDown(e) {
    if (disabled || exiting || !onDelete) return
    if (e.button != null && e.button !== 0) return
    // A drag handle or a nested control owns its own gesture.
    if (e.target.closest?.('[data-no-swipe]')) return
    origin.current = { x: e.clientX, y: e.clientY }
    engaged.current = false
  }

  function onPointerMove(e) {
    if (!origin.current) return

    const moveX = e.clientX - origin.current.x
    const moveY = e.clientY - origin.current.y

    if (!engaged.current) {
      // Vertical first means this was a scroll, and the row must not twitch.
      if (Math.abs(moveY) > Math.abs(moveX)) return reset()
      if (Math.abs(moveX) < ENGAGE_PX) return
      if (Math.abs(moveX) < Math.abs(moveY) * HORIZONTAL_BIAS) return

      engaged.current = true
      // Keeps the gesture once the finger leaves the row, which it does as
      // soon as the row starts moving out from under it.
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }

    // Left only. Rubber-banding a rightward pull would imply a second action
    // hiding on that side, and there isn't one.
    setDx(Math.min(0, moveX - Math.sign(moveX) * ENGAGE_PX))
  }

  function onPointerUp() {
    if (!origin.current) return

    const far = dx <= -COMMIT_PX
    if (engaged.current) swallow.current = true

    if (far && onDelete) {
      setExiting(true)
      origin.current = null
      engaged.current = false
      // Off the edge first, then remove. Every caller deletes optimistically,
      // so the row would otherwise vanish mid-gesture with no sense of where
      // it went — and where it went is the point, given there is an undo.
      exitTimer.current = setTimeout(onDelete, EXIT_MS)
      return
    }

    reset()
  }

  const armed = dx <= -COMMIT_PX

  return (
    <div className={exiting ? 'swipe is-exiting' : 'swipe'}>
      {/* Behind the row, revealed by it moving. Not a button: the gesture is
          the control, and a target here would be a second way to do the same
          thing that only appears once you are already doing it. */}
      <div className={armed ? 'swipe__reveal is-armed' : 'swipe__reveal'} aria-hidden="true">
        <span>{armed ? `Release to ${label.toLowerCase()}` : label}</span>
      </div>

      <div
        className={dx === 0 && !exiting ? 'swipe__track' : 'swipe__track is-moving'}
        style={exiting ? undefined : { transform: `translateX(${dx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        /* The click the browser fires when the finger lifts would otherwise
           tick the chore the swipe was about to delete. Capture, so it never
           reaches the row's own handler. */
        onClickCapture={(e) => {
          if (!swallow.current) return
          swallow.current = false
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {children}
      </div>
    </div>
  )
}
