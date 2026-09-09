import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dragging a chore onto a day.
 *
 * Not the HTML5 drag-and-drop API. dragstart/dragover/drop never fire for
 * touch on iPadOS, so a feature built on them would work perfectly on the
 * Mac used to develop it and not exist at all on the wall it is for.
 * Pointer events cover mouse and touch with one path.
 *
 * Dragging starts from an explicit handle rather than a long press on the
 * row, which is the decision doing most of the work here:
 *
 *  - The panel scrolls vertically and the grid sits above it, so "drag up to
 *    schedule" and "scroll the list" would otherwise be the same motion. The
 *    handle carries touch-action: none, so the browser never claims that
 *    gesture as a scroll, while the rest of the row scrolls normally.
 *  - The row itself is a <button> that toggles done. A handle beside it
 *    rather than on it means a drag can never be mistaken for a tick, with
 *    no click-swallowing needed afterwards.
 *  - A long press would have had to out-time both the panel scroll and the
 *    board's own 650ms settings press, on glass where a resting fingertip
 *    emits a steady dribble of move events. That lesson is already written
 *    into LONG_PRESS_SLOP_PX; this avoids needing it again.
 *
 * Drop targets announce themselves with data-drop-day="<iso>" for a day, or
 * data-drop-backlog for the panel, so nothing here needs to know what the
 * board looks like.
 */
export function useChoreDrag(onDrop) {
  const [drag, setDrag] = useState(null) // { chore, x, y, over }
  const chore = useRef(null)
  const active = drag !== null

  const startDrag = useCallback((c, event) => {
    // Keeps the press off the row's toggle and off the board's long-press.
    event.preventDefault()
    event.stopPropagation()

    chore.current = c
    // Pointer capture keeps the gesture alive when the finger leaves the
    // handle, which it does immediately and by design.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ chore: c, x: event.clientX, y: event.clientY, over: null })
  }, [])

  useEffect(() => {
    if (!active) return

    function targetAt(x, y) {
      // The ghost follows the pointer, so it must not be hit-testable or it
      // would be the only thing ever found here. See .chore-ghost.
      const el = document.elementFromPoint(x, y)
      const day = el?.closest?.('[data-drop-day]')
      if (day) return { kind: 'day', date: day.getAttribute('data-drop-day') }
      if (el?.closest?.('[data-drop-backlog]')) return { kind: 'backlog' }
      return null
    }

    function move(e) {
      e.preventDefault()
      const over = targetAt(e.clientX, e.clientY)
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over } : d))
    }

    function end(e) {
      const over = e.type === 'pointercancel' ? null : targetAt(e.clientX, e.clientY)
      const dropped = chore.current
      chore.current = null
      setDrag(null)
      if (dropped && over) onDrop(dropped, over)
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [active, onDrop])

  return { drag, startDrag }
}
