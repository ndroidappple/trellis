import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { useWidgetDrag } from '../hooks/useWidgetDrag';
import { useWidgetResize } from '../hooks/useWidgetResize';
import { GRID_CONFIG, ROW_MIN_PX, tryMove, tryResize, pixelDeltaToCellDelta } from '../hooks/useWidgetGrid';
import './WidgetGrid.css';

export interface Placement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Gap between cells, in px — kept as one constant both the CSS and this
    component's own pixel math read, so they can never disagree. */
export const WIDGET_GAP_PX = 16;

interface Props {
  orientation: 'portrait' | 'landscape';
  layout: Placement[];
  rearranging: boolean;
  onCommitLayout: (next: Placement[]) => void;
  minSpans: Record<string, { w: number; h: number }>;
  renderTile: (
    placement: Placement,
    gesture: {
      onDragHandlePointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
      onResizeHandlePointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
    }
  ) => ReactNode;
}

export function WidgetGrid({ orientation, layout, rearranging, onCommitLayout, minSpans, renderTile }: Props) {
  const gridConfig = GRID_CONFIG[orientation];
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cellSizePx = useMemo(
    () => ({
      w: Math.max(1, (containerSize.width - (gridConfig.cols - 1) * WIDGET_GAP_PX) / gridConfig.cols),
      h: Math.max(1, (containerSize.height - (gridConfig.rows - 1) * WIDGET_GAP_PX) / gridConfig.rows),
      gap: WIDGET_GAP_PX,
    }),
    [containerSize.width, containerSize.height, gridConfig.cols, gridConfig.rows]
  );

  // Latest values in refs so the drag/resize callbacks stay referentially
  // stable — otherwise every pointermove (which updates `drag`'s x/y and
  // re-renders this component) would hand useWidgetDrag/useWidgetResize a
  // new callback identity, tearing down and re-adding their window
  // listeners on every tick of the gesture instead of once per gesture.
  // Synced in an effect rather than written directly during render (a ref
  // is only ever read later, from an event handler, so there's no need for
  // it to be current before paint — a plain effect is enough, and reading
  // or writing `.current` during render itself is the thing to avoid).
  const layoutRef = useRef(layout);
  const cellSizePxRef = useRef(cellSizePx);
  const minSpansRef = useRef(minSpans);
  useEffect(() => {
    layoutRef.current = layout;
    cellSizePxRef.current = cellSizePx;
    minSpansRef.current = minSpans;
  }, [layout, cellSizePx, minSpans]);

  const handleDrop = useCallback(
    (widgetId: string, overCell: { col: number; row: number } | null) => {
      if (!overCell) return; // dropped outside the grid entirely — snap back
      const result = tryMove(layoutRef.current, widgetId, { x: overCell.col, y: overCell.row }, gridConfig);
      if (result.ok) onCommitLayout(result.layout);
      // Rejected (collision/out-of-bounds): layout is untouched, so the tile
      // simply re-renders at its last committed position once `drag`
      // becomes null below — reject-and-snap-back per the Phase 1 plan.
    },
    [gridConfig, onCommitLayout]
  );

  const handleResizeCommit = useCallback(
    (widgetId: string, dxPx: number, dyPx: number) => {
      const current = layoutRef.current.find((p) => p.id === widgetId);
      if (!current) return;
      const { dx, dy } = pixelDeltaToCellDelta(dxPx, dyPx, cellSizePxRef.current);
      const result = tryResize(
        layoutRef.current,
        widgetId,
        { w: current.w + dx, h: current.h + dy },
        gridConfig,
        minSpansRef.current[widgetId]
      );
      if (result.ok) onCommitLayout(result.layout);
    },
    [gridConfig, onCommitLayout]
  );

  const { drag, startDrag } = useWidgetDrag(handleDrop);
  const { resize, startResize } = useWidgetResize(handleResizeCommit);

  // The layout actually rendered this frame: `layout` at rest, or a live
  // candidate while a drag/resize is in flight — computed with the exact
  // same tryMove/tryResize the eventual commit uses, so the preview and the
  // committed result can never disagree about what's valid.
  const previewLayout = useMemo(() => {
    if (drag && drag.overCell) {
      const result = tryMove(layout, drag.widgetId, { x: drag.overCell.col, y: drag.overCell.row }, gridConfig);
      return result.ok ? result.layout : layout;
    }
    if (resize) {
      const current = layout.find((p) => p.id === resize.widgetId);
      if (current) {
        const { dx, dy } = pixelDeltaToCellDelta(resize.dx, resize.dy, cellSizePx);
        const result = tryResize(
          layout,
          resize.widgetId,
          { w: current.w + dx, h: current.h + dy },
          gridConfig,
          minSpans[resize.widgetId]
        );
        return result.ok ? result.layout : layout;
      }
    }
    return layout;
  }, [layout, drag, resize, gridConfig, cellSizePx, minSpans]);

  const gridFloorPx = gridConfig.rows * ROW_MIN_PX + (gridConfig.rows - 1) * WIDGET_GAP_PX;
  const activeId = drag?.widgetId ?? resize?.widgetId ?? null;

  return (
    <div
      ref={containerRef}
      className="widget-grid"
      data-orientation={orientation}
      data-rearranging={rearranging ? 'true' : undefined}
      style={{
        minHeight: gridFloorPx,
        gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`,
        gridTemplateRows: `repeat(${gridConfig.rows}, minmax(${ROW_MIN_PX}px, 1fr))`,
        gap: WIDGET_GAP_PX,
      }}
    >
      {previewLayout.map((placement) => (
        <div
          key={placement.id}
          className="widget-grid__cell"
          data-active={placement.id === activeId ? 'true' : undefined}
          style={{
            gridColumn: `${placement.x + 1} / span ${placement.w}`,
            gridRow: `${placement.y + 1} / span ${placement.h}`,
            pointerEvents: placement.id === activeId && drag ? 'none' : undefined,
          }}
        >
          {renderTile(placement, {
            onDragHandlePointerDown: (e) => startDrag(placement.id, e),
            onResizeHandlePointerDown: (e) => startResize(placement.id, e),
          })}
        </div>
      ))}

      {/* Hit-test surface for useWidgetDrag's elementFromPoint lookup — only
          rendered during an active drag, and on top of everything else so
          it, not a settled tile, is what the pointer actually finds. See
          useWidgetDrag.js's doc comment for why this mirrors useChoreDrag's
          data-drop-day pattern rather than tracking pixels directly. */}
      {drag &&
        Array.from({ length: gridConfig.cols * gridConfig.rows }, (_, i) => {
          const col = i % gridConfig.cols;
          const row = Math.floor(i / gridConfig.cols);
          return (
            <div
              key={`drop-${col}-${row}`}
              className="widget-grid__drop-cell"
              data-drop-cell={`${col},${row}`}
              style={{ gridColumn: `${col + 1} / span 1`, gridRow: `${row + 1} / span 1` }}
            />
          );
        })}
    </div>
  );
}
