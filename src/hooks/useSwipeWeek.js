import { useCallback, useRef, useState } from 'react'

/**
 * How far the grid must be dragged, on release, to commit a week change.
 *
 * 80px committed too easily: a normal flick crosses it before the "Release
 * for…" hint has even had a chance to become legible, so people were landing
 * on a different week before they'd consciously decided to. This is a bigger
 * number than SwipeAway's COMMIT_PX (96px) on purpose — that gesture commits
 * a reversible action with a nine-second undo behind it; this one re-anchors
 * the whole board, with nothing to undo it back to where you were, so it
 * should ask for a more deliberate drag, not a lighter one.
 */
const COMMIT_PX = 160

/**
 * The furthest the grid visually follows the finger. Travel past this is
 * still tracked (so releasing well beyond it still commits), it just stops
 * moving anything — the same hard-clamp shape as SwipeAway's MAX_REVEAL,
 * for the same reason: a drag that kept dragging forever would look like the
 * board coming loose rather than a page being turned. Kept 80px above
 * COMMIT_PX, same margin as before, so there's still room to keep dragging
 * — and see the "Release for…" hint hold steady — after it arms.
 */
const MAX_DRAG_PX = 240

/**
 * Same engagement test as SwipeAway, and deliberately the same numbers: a
 * horizontal move has to clear ENGAGE_PX and beat vertical movement by
 * HORIZONTAL_BIAS before it counts as a swipe at all. Two different gestures
 * on two different surfaces agreeing on what "this is a swipe, not a tap
 * that wobbled" means is what makes them both feel like the same touch
 * vocabulary rather than two features that happen to share a word.
 */
const ENGAGE_PX = 12
const HORIZONTAL_BIAS = 1.4

/**
 * Swipe the week grid to page the week — left for next, right for previous.
 *
 * Lives at the grid level, not per-row: SwipeAway answers "delete this one
 * row" and is built into a row for exactly that reason, but this answers
 * "show a different week," which is a fact about the whole grid, so one
 * gesture region covers all seven rows rather than seven independent ones.
 *
 * The shape is deliberately borrowed from SwipeAway rather than invented
 * fresh: prove a drag is a swipe (engagement test) before doing anything
 * with it, track it live for real tactile feedback, and swallow the click a
 * pointer-up always produces so a swipe that started on a day row does not
 * also open that day underneath it. A gesture that shares a surface with an
 * existing tap has to out-argue that tap explicitly or it will lose to it
 * silently.
 *
 * **What it deliberately does not do:** animate the incoming week sliding in
 * from the direction implied by the drag. That needs both weeks rendered at
 * once to look right, and this only ever renders one. Committing instead
 * snaps back to rest with no transition in the same tick the new week's data
 * arrives — the drag itself is where the physical feedback lives; the result
 * is just the next week, at rest, the way tapping an arrow already produces
 * it. Only a release that does *not* commit gets an eased return, because
 * that is genuinely "back to where it was," not a transition to somewhere new.
 */
export function useSwipeWeek({ onPrevWeek, onNextWeek } = {}) {
  const [dragX, setDragX] = useState(0)
  const [settling, setSettling] = useState(false)

  const origin = useRef(null)
  const engaged = useRef(false)
  const swallow = useRef(false)

  const onPointerDown = useCallback((e) => {
    if (e.button != null && e.button !== 0) return
    origin.current = { x: e.clientX, y: e.clientY }
    engaged.current = false
    setSettling(false)
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!origin.current) return

    const moveX = e.clientX - origin.current.x
    const moveY = e.clientY - origin.current.y

    if (!engaged.current) {
      // Vertical first means this was never headed at the week grid, which
      // has nothing to scroll — but a stray drag toward a dialog edge or a
      // diagonal mis-touch shouldn't turn into a week change either.
      if (Math.abs(moveY) > Math.abs(moveX)) {
        origin.current = null
        return
      }
      if (Math.abs(moveX) < ENGAGE_PX) return
      if (Math.abs(moveX) < Math.abs(moveY) * HORIZONTAL_BIAS) return

      engaged.current = true
      // Keeps the gesture even if the finger wanders off the grid, the same
      // way SwipeAway keeps a row once it starts sliding out from under it.
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }

    const clamped = Math.sign(moveX) * Math.min(Math.abs(moveX), MAX_DRAG_PX)
    setDragX(clamped)
  }, [])

  const onPointerUp = useCallback(
    (e) => {
      if (!origin.current) return
      origin.current = null
      if (!engaged.current) return
      engaged.current = false

      // The click this pointer-up is about to produce must not also open
      // whatever day row happened to be under the finger.
      swallow.current = true

      const committed = dragX <= -COMMIT_PX ? 'next' : dragX >= COMMIT_PX ? 'prev' : null

      if (committed === 'next') onNextWeek?.()
      else if (committed === 'prev') onPrevWeek?.()

      // Committed: snap to rest with no transition, in the same tick the new
      // week's rows arrive — see the doc comment above for why this doesn't
      // try to animate the swap itself. Not committed: ease back, because
      // this really is a return to where things already were.
      setSettling(committed === null)
      setDragX(0)

      e.currentTarget.releasePointerCapture?.(e.pointerId)
    },
    [dragX, onNextWeek, onPrevWeek]
  )

  const onPointerCancel = useCallback((e) => {
    origin.current = null
    engaged.current = false
    setSettling(true)
    setDragX(0)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }, [])

  const onClickCapture = useCallback((e) => {
    if (!swallow.current) return
    swallow.current = false
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return {
    dragX,
    settling,
    // A light fade while dragging — cheap, and it reads as "this is
    // leaving" without needing a second week rendered to sell the idea.
    // Derived here rather than left for a caller to reimplement against
    // MAX_DRAG_PX, which would otherwise be a second place that constant
    // has to be kept in sync.
    opacity: 1 - (Math.abs(dragX) / MAX_DRAG_PX) * 0.1,
    // Past this, releasing commits. Exposed so a caller can confirm the
    // release before it happens — the same "Release to…" idiom SwipeAway
    // uses — without hardcoding COMMIT_PX a second place.
    armed: Math.abs(dragX) >= COMMIT_PX,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  }
}
