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
  const active = resize !== null

  const startResize = useCallback((id, event) => {
    event.preventDefault()
    event.stopPropagation()

    widgetId.current = id
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setResize({ widgetId: id, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 })
  }, [])

  useEffect(() => {
    if (!active) return

    function move(e) {
      e.preventDefault()
      setResize((r) => (r ? { ...r, dx: e.clientX - r.startX, dy: e.clientY - r.startY } : r))
    }

    function end() {
      const id = widgetId.current
      widgetId.current = null
      setResize((r) => {
        if (id && r) onCommit(id, r.dx, r.dy)
        return null
      })
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
