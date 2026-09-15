import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Liquid } from 'liquid-gooey';
import { useWidgetDrag } from '../hooks/useWidgetDrag';
import { useWidgetResize } from '../hooks/useWidgetResize';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { GRID_CONFIG, ROW_MIN_PX, tryMove, tryResize, pixelDeltaToCellDelta, cellToPixel } from '../hooks/useWidgetGrid';
import './WidgetGrid.css';

/**
 * How long the settle animation (drag snap-back/arrival, resize clamp) runs
 * — matched to tokens.css's --dur-move, the token this app already uses for
 * "a thing moved: reorder, sink" (see CLAUDE.md's Motion section). Kept as
 * a real number here (not read from the CSS var) only because a JS timeout
 * needs a number to schedule against; the animation ITSELF reads the token
 * directly so the two can't drift in the value that actually paints.
 */
const SETTLE_MS = 220;

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

  const reducedMotion = usePrefersReducedMotion();

  // Which tile, if any, is mid-settle after a drag/resize just ended — the
  // brief animated leg from wherever the gesture left it to its final
  // committed (or reverted) place. `null` at rest, which is also every
  // frame while reducedMotion is on: nothing here ever sets it in that
  // case, so <Liquid> never mounts and the tile renders exactly as it did
  // before Phase 4 touched this file.
  const [settle, setSettle] = useState<{ id: string; kind: 'drag' | 'resize' } | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginSettle = useCallback((id: string, kind: 'drag' | 'resize') => {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    setSettle({ id, kind });
    settleTimeoutRef.current = setTimeout(() => {
      setSettle(null);
      settleTimeoutRef.current = null;
    }, SETTLE_MS);
  }, []);

  useEffect(() => () => {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
  }, []);

  const handleDrop = useCallback(
    (widgetId: string, overCell: { col: number; row: number } | null) => {
      if (!overCell) {
        beginSettle(widgetId, 'drag'); // dropped outside the grid — snap back
        return;
      }
      const result = tryMove(layoutRef.current, widgetId, { x: overCell.col, y: overCell.row }, gridConfig);
      if (result.ok) onCommitLayout(result.layout);
      // Rejected (collision/out-of-bounds): layout is untouched, so the tile
      // settles back to its last committed position — reject-and-snap-back
      // per the Phase 1 plan, now animated instead of instant.
      beginSettle(widgetId, 'drag');
    },
    [gridConfig, onCommitLayout, beginSettle]
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
      beginSettle(widgetId, 'resize');
    },
    [gridConfig, onCommitLayout, beginSettle]
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
      {previewLayout.map((placement) => {
        const isDragging = !reducedMotion && drag?.widgetId === placement.id;
        const isResizing = !reducedMotion && resize?.widgetId === placement.id;
        const isSettlingDrag = !reducedMotion && !isDragging && !isResizing && settle?.id === placement.id && settle.kind === 'drag';
        const isSettlingResize = !reducedMotion && !isDragging && !isResizing && settle?.id === placement.id && settle.kind === 'resize';
        const gesturing = isDragging || isResizing || isSettlingDrag || isSettlingResize;

        // Grid placement never changes for the gesturing tile itself — only
        // an ADDITIONAL transform (drag) or an explicit pixel size
        // override (resize) rides on top of it, so the tile never leaves
        // CSS Grid flow and never touches `position`/`pointer-events` on
        // any ancestor mid-gesture (see the WebKit note this replaced,
        // still true: that's the one thing that broke real touch here once
        // already).
        const cellStyle: CSSProperties = {
          gridColumn: `${placement.x + 1} / span ${placement.w}`,
          gridRow: `${placement.y + 1} / span ${placement.h}`,
        };

        if (isDragging || isSettlingDrag) {
          // Live: the gap between where the finger actually is and where
          // the grid has already snapped this tile to — recomputed fresh
          // every frame, so the discrete grid jump and this residual cancel
          // out and the visible position tracks the pointer continuously.
          // Settling: the same transform relaxes to zero via a real CSS
          // transition, animating from whatever was actually last painted
          // (no separate "from" state needed — the DOM already remembers).
          const target = isDragging
            ? (() => {
                const snapped = cellToPixel(placement, cellSizePx);
                return {
                  x: drag!.x - drag!.grabOffset.x - snapped.left,
                  y: drag!.y - drag!.grabOffset.y - snapped.top,
                };
              })()
            : { x: 0, y: 0 };
          cellStyle.transform = `translate(${target.x}px, ${target.y}px)`;
          cellStyle.transition = isDragging ? 'none' : 'transform var(--dur-move) var(--ease-standard)';
        }

        if (isResizing || isSettlingResize) {
          const committed = cellToPixel(placement, cellSizePx);
          if (isResizing) {
            const minSpan = minSpans[placement.id];
            const minWidth = minSpan ? minSpan.w * cellSizePx.w + (minSpan.w - 1) * cellSizePx.gap : 0;
            const minHeight = minSpan ? minSpan.h * cellSizePx.h + (minSpan.h - 1) * cellSizePx.gap : 0;
            cellStyle.width = Math.max(minWidth, committed.width + resize!.dx);
            cellStyle.height = Math.max(minHeight, committed.height + resize!.dy);
            cellStyle.transition = 'none';
          } else {
            cellStyle.width = committed.width;
            cellStyle.height = committed.height;
            cellStyle.transition = 'width var(--dur-move) var(--ease-standard), height var(--dur-move) var(--ease-standard)';
          }
        }

        const tileContent = renderTile(placement, {
          onDragHandlePointerDown: (e) => startDrag(placement.id, e),
          onResizeHandlePointerDown: (e) => startResize(placement.id, e),
        });

        return (
          <div
            key={placement.id}
            className="widget-grid__cell"
            data-active={gesturing ? 'true' : undefined}
            style={cellStyle}
            // Deliberately NOT `pointerEvents: 'none'` here, ever — see the
            // comment this replaced: mutating pointer-events on an ancestor
            // of the element holding setPointerCapture is what silently
            // killed every real touch gesture on the actual iPad once
            // already (confirmed on hardware; mouse-driven testing never
            // surfaced it). Only transform/size ride on top of grid
            // placement above, deliberately never pointer-events.
          >
            {gesturing ? (
              // Mounted only for the gesture's duration (live + its brief
              // settle) and unmounted the instant SETTLE_MS elapses — see
              // the "interaction-triggered only" rule in the widget-
              // home-screen plan's Phase 4 section. The actual motion above
              // is this component's own CSS transform/transition, driven
              // and guaranteed correct independent of Liquid; Liquid.Item
              // is layered on as an observer (no x/y/width/height passed to
              // it directly — "observe" mode per its own docs, watching
              // this already-moving child's measured rect) purely for the
              // gooey visual it's actually here for.
              <Liquid
                blur={isResizing || isSettlingResize ? 6 : 8}
                contrast={isResizing || isSettlingResize ? 18 : 20}
                fill="var(--slat-face)"
                shadow="var(--lift)"
              >
                <Liquid.Item
                  effect={isResizing || isSettlingResize ? 'bend' : 'move'}
                  move={{ springiness: 0.5, trail: 0.5 }}
                  bend={{ vertical: 0.6, horizontal: 0.35 }}
                >
                  {tileContent}
                </Liquid.Item>
              </Liquid>
            ) : (
              tileContent
            )}
          </div>
        );
      })}

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
