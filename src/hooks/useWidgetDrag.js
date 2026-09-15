import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dragging a widget tile to a new cell. Deliberately the same shape as
 * `useChoreDrag.js` — pointer events, not HTML5 drag-and-drop, because
 * dragstart/dragover/drop never fire for touch on iPadOS (see that file's
 * own doc comment). Started from an explicit handle rather than a long
 * press on the tile, for the same reason: a tile hosts live interactive
 * content (a chore checkbox, an event chip, a light toggle), so a handle
 * beside that content means a drag can never be mistaken for using it.
 *
 * Unlike `useChoreDrag` (which hit-tests a handful of day rows), a widget
 * can land on any cell of the grid — so the grid renders one
 * `data-drop-cell="col,row"` marker per cell only while a drag is active,
 * and this hook hit-tests against those the same way `useChoreDrag` hit-
 * tests `data-drop-day`. Nothing here needs to know the grid's own
 * dimensions or content.
 */
export function useWidgetDrag(onDrop) {
  const [drag, setDrag] = useState(null) // { widgetId, x, y, overCell, grabOffset }
  const widgetId = useRef(null)
  const active = drag !== null

  const startDrag = useCallback((id, event) => {
    // Keeps the press off whatever the tile's content would otherwise do
    // with it, and off the board's own long-press-to-settings gesture.
    event.preventDefault()
    event.stopPropagation()

    widgetId.current = id
    event.currentTarget.setPointerCapture?.(event.pointerId)

    // Where inside the tile it was actually grabbed, not the tile's
    // top-left corner — Phase 4's continuous drag rendering (WidgetGrid.tsx)
    // subtracts this from the live pointer position so the tile tracks the
    // finger from where it was picked up. Measured off the nearest grid
    // cell wrapper, since the grip button itself is a small fraction of the
    // tile — grabbing an edge shouldn't make the whole tile jump under it.
    const cellEl = event.currentTarget.closest?.('.widget-grid__cell')
    const rect = cellEl?.getBoundingClientRect()
    const grabOffset = rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: 0, y: 0 }

    setDrag({ widgetId: id, x: event.clientX, y: event.clientY, overCell: null, grabOffset })
  }, [])

  useEffect(() => {
    if (!active) return

    function cellAt(x, y) {
      const el = document.elementFromPoint(x, y)
      const cellEl = el?.closest?.('[data-drop-cell]')
      if (!cellEl) return null
      const [col, row] = cellEl.getAttribute('data-drop-cell').split(',').map(Number)
      return { col, row }
    }

    function move(e) {
      e.preventDefault()
      const overCell = cellAt(e.clientX, e.clientY)
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overCell } : d))
    }

    function end(e) {
      const overCell = e.type === 'pointercancel' ? null : cellAt(e.clientX, e.clientY)
      const dropped = widgetId.current
      widgetId.current = null
      setDrag(null)
      if (dropped) onDrop(dropped, overCell)
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
