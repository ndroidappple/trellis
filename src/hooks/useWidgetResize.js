import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Resizing a widget tile from a corner grip. Kept separate from
 * `useWidgetDrag` on purpose — resize math is genuinely different
 * (accumulating a pixel delta from a fixed start point and converting it
 * to a cell-size delta) from drag's discrete cell hit-testing, not a
 * variation on the same gesture. No resize concept exists anywhere else in
 * this app, so unlike drag there's no prior pattern to mirror — this is
 * pointer-capture applied the same proven way (see `useChoreDrag.js`),
 * not an extension of anything.
 *
 * Reports the live pixel delta rather than a cell delta so the caller (who
 * knows the grid's measured cell size) decides how to round/clamp it —
 * this hook only owns the gesture, not grid math (that's `useWidgetGrid`'s
 * job, via `pixelDeltaToCellDelta` + `tryResize`).
 */
export function useWidgetResize(onCommit) {
  const [resize, setResize] = useState(null) // { widgetId, dx, dy }
  const widgetId = useRef(null)
  const startPos = useRef({ x: 0, y: 0 })
  // Mirrors `resize`'s dx/dy for `end()` to read synchronously. Written
  // directly in `move()` below — a plain event-handler assignment, not
  // inside a state updater — precisely because a previous version of this
  // hook called `onCommit` (which reaches all the way up to Wall's own
  // setState) from *inside* setResize's functional-updater callback.
  // React updaters must be pure; calling another component's setState from
  // one is exactly what "Cannot update a component while rendering a
  // different component" warns about, and it's not just a lint nicety —
  // confirmed on the real iPad as the reason resize (and drag, which had
  // the same shape) silently did nothing: React's dev-mode purity check
  // (StrictMode double-invokes updaters) could fire the commit during a
  // render pass instead of the pointerup handler.
  const latestDelta = useRef({ dx: 0, dy: 0 })
  const active = resize !== null

  const startResize = useCallback((id, event) => {
    event.preventDefault()
    event.stopPropagation()

    widgetId.current = id
    startPos.current = { x: event.clientX, y: event.clientY }
    latestDelta.current = { dx: 0, dy: 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setResize({ widgetId: id, dx: 0, dy: 0 })
  }, [])

  useEffect(() => {
    if (!active) return

    function move(e) {
      e.preventDefault()
      const dx = e.clientX - startPos.current.x
      const dy = e.clientY - startPos.current.y
      latestDelta.current = { dx, dy }
      setResize((r) => (r ? { ...r, dx, dy } : r))
    }

    function end() {
      const id = widgetId.current
      widgetId.current = null
      setResize(null)
      if (id) onCommit(id, latestDelta.current.dx, latestDelta.current.dy)
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [active, onCommit])

  return { resize, startResize }
}
