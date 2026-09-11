import { useCallback, useEffect, useRef, useState } from 'react'
import './SwipeAway.css'

/** How far the row must be drawn aside, on release, to commit the delete. */
const COMMIT_PX = 96

/** And the furthest it will go, so a row can never be dragged clean off. */
const MAX_REVEAL = 168

/**
 * How far horizontal a drag must be before it is a swipe at all.
 *
 * Both numbers matter. `ENGAGE_PX` keeps a tap that wobbles from peeling the
 * row open; the ratio keeps a diagonal scroll from being read as a swipe. The
 * panel this lives in scrolls vertically and is frequently read by someone
 * dragging a finger down it, so the failure that matters is a scroll that
 * opens rows, not a swipe that needs repeating.
 */
const ENGAGE_PX = 12
const HORIZONTAL_BIAS = 1.4

/** The slide-out before the row is actually removed. Matches --dur-move. */
const EXIT_MS = 220

/**
 * Roughly where the reveal is wide enough to hold the whole label.
 *
 * "Delete" at --size-min plus the 16px gutters either side. Approximate on
 * purpose: it only decides when a fade starts, and a word that appears a few
 * pixels early or late is not a bug, whereas one that appears half-cut is.
 */
const LABEL_FITS_AT = 80

/**
 * Swipe a row left to delete it.
 *
 * Wraps a row rather than being built into one, because the three places this
 * is wanted — chores, shopping, the day sheet's tasks — have three different
 * row components and only this behaviour in common.
 *
 * ── Why a swipe, when both lists had refused a delete button ──
 *
 * The shopping dock has none on purpose: a permanent 44px "×" beside the
 * primary tap is a mis-tap generator on a wall, for something done about once
 * a month (see `ShoppingAisles`). The chore row went the same way and moved
 * delete two taps down into a settings sheet. Both were right against the
 * options available, and both left the common case slow. A swipe costs no
 * pixels at rest and cannot be triggered by the imprecise press a wall
 * attracts — so the action can exist without the neighbour.
 *
 * ── The reveal is as wide as the swipe, and that is the whole trick ──
 *
 * It first spanned the row at `inset: 0` and relied on the row covering it
 * until swiped. The row does not cover it: `.checklist-row` sits on
 * `--row-face`, which is 3.5% ink. So every row on the board wore a red tint
 * with the word "Delete" showing straight through it, printed over the
 * schedule label on its right — visible in a photograph of the wall, at rest,
 * with nobody touching anything.
 *
 * Now the panel's width *is* the distance swiped. At rest it is zero wide and
 * occupies nothing, so there is nothing to bleed through a translucent row and
 * nothing to overlap. **A reveal that has to be covered to stay hidden is one
 * repaint away from being visible; one with no width cannot be.**
 *
 * ── What keeps it off scrolls ──
 *
 * `touch-action: pan-y` on the track hands vertical panning to the browser and
 * keeps horizontal for us, so the list scrolls normally and neither gesture
 * has to out-race the other. The engagement test above is the second line of
 * that defence for pointer devices, where `touch-action` does nothing.
 *
 * ── And from deleting things by accident ──
 *
 * Nothing here is irreversible: every caller's handler routes through
 * `offerUndo`, so a swipe lands the same nine-second undo a delete from a
 * sheet does. That is what makes a one-gesture delete affordable at all on a
 * screen mounted in a kitchen.
 *
 * The old routes stay. The chore sheet still deletes, the shopping page keeps
 * its "×". A swipe has no keyboard and no screen-reader equivalent and cannot
 * be the only way to do anything.
 */
export default function SwipeAway({ onDelete, label = 'Delete', disabled = false, children }) {
  /** How far the row is drawn aside, 0…MAX_REVEAL. */
  const [revealed, setRevealed] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exiting, setExiting] = useState(false)

  const origin = useRef(null)
  const engaged = useRef(false)
  const swallow = useRef(false)
  const exitTimer = useRef(null)

  useEffect(() => () => clearTimeout(exitTimer.current), [])

  const settle = useCallback(() => {
    setRevealed(0)
    setDragging(false)
  }, [])

  function onPointerDown(e) {
    if (disabled || exiting || !onDelete) return
    if (e.button != null && e.button !== 0) return
    // The drag grip and the shopping "×" own their own gestures.
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
      if (Math.abs(moveY) > Math.abs(moveX)) {
        origin.current = null
        return
      }
      if (Math.abs(moveX) < ENGAGE_PX) return
      if (Math.abs(moveX) < Math.abs(moveY) * HORIZONTAL_BIAS) return

      engaged.current = true
      setDragging(true)
      // Keeps the gesture once the finger leaves the row, which it does as
      // soon as the row starts moving out from under it.
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }

    // Leftward only. Rubber-banding a rightward pull would imply a second
    // action hiding on that side, and there isn't one.
    const next = -moveX - Math.sign(moveX) * ENGAGE_PX
    setRevealed(Math.max(0, Math.min(MAX_REVEAL, next)))
  }

  function onPointerUp() {
    if (!origin.current) return
    origin.current = null

    if (!engaged.current) return
    engaged.current = false
    // The click the lift produces must not tick the row on its way out.
    swallow.current = true

    if (revealed >= COMMIT_PX && onDelete) {
      setExiting(true)
      setDragging(false)
      // Off the edge first, then remove. Every caller deletes optimistically,
      // so the row would otherwise vanish under the finger with no sense of
      // where it went — and where it went matters, given there is an undo.
      exitTimer.current = setTimeout(onDelete, EXIT_MS)
      return
    }

    settle()
  }

  const armed = revealed >= COMMIT_PX

  return (
    <div className={exiting ? 'swipe is-exiting' : 'swipe'}>
      {/*
        Width is the swipe. Zero at rest, so nothing shows through the row and
        nothing overlaps what the row draws on its own right-hand side.

        Not a button: the gesture is the control, and a target here would be a
        second way to do the same thing that only appears once you are already
        doing it.
      */}
      <div
        className={armed ? 'swipe__reveal is-armed' : 'swipe__reveal'}
        style={{ width: revealed }}
        aria-hidden="true"
      >
        {/*
          Faded in rather than slid in, and not until the word fits.

          The label is anchored to the panel's right edge, so a narrow panel
          clips its *left* side: "Delete" spends the first part of the swipe
          reading "ete", which looks like a defect rather than a control
          arriving. `LABEL_FITS_AT` is where the panel is wide enough for the
          whole word plus its gutter, so the fade runs from just below that to
          just above it and the word is never both visible and cut.
        */}
        <span
          className="swipe__label"
          style={{
            opacity: Math.min(1, Math.max(0, (revealed - LABEL_FITS_AT + 16) / 24)),
          }}
        >
          {label}
        </span>
      </div>

      <div
        className={dragging ? 'swipe__track is-dragging' : 'swipe__track'}
        style={{ transform: `translateX(${-revealed}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          origin.current = null
          engaged.current = false
          settle()
        }}
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
