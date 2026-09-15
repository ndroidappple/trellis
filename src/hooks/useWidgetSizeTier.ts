import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * How much a To-Do/Shopping tile can show, given how big it's been dragged.
 *
 *   micro   — a single stat, no per-item chips
 *   compact — a strip of chips (today's dock summary)
 *   full    — the scrollable list
 *
 * Calendar keeps useDetailLevel/weightedRowsFor unchanged (see Board.tsx) —
 * this hook is only for the two widgets whose shape used to be a stored
 * Full/Compact *setting* and is now something you get by dragging the tile.
 */
export type WidgetSizeTier = 'micro' | 'compact' | 'full';

/**
 * Height alone decides full vs. not: full means there's room for a real
 * scrollable list, and below that there's no scrolling to do anyway, so the
 * shape has to change instead. First-guess, same status as this feature's
 * other unmeasured constants (ROW_MIN_PX, GRID_CONFIG) — roughly 4-5 rows
 * plus the pinned AddRow, not yet checked against the real 11" iPad.
 */
const ENTER_TALL = 360;
const EXIT_TALL = 320;

/**
 * Below ENTER_TALL, width decides compact (a chip strip) vs. micro (one
 * stat). First-guess: wide enough for two .panel-chips at their existing
 * padding.
 */
const ENTER_WIDE = 260;
const EXIT_WIDE = 230;

function nextTall(current: boolean, height: number): boolean {
  if (current) return height < EXIT_TALL ? false : true;
  return height >= ENTER_TALL;
}

function nextWide(current: boolean, width: number): boolean {
  if (current) return width < EXIT_WIDE ? false : true;
  return width >= ENTER_WIDE;
}

export function useWidgetSizeTier(): [RefObject<HTMLDivElement | null>, WidgetSizeTier] {
  const ref = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<WidgetSizeTier>('full');
  const tallRef = useRef(true);
  const wideRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (width: number, height: number) => {
      const tall = nextTall(tallRef.current, height);
      const wide = nextWide(wideRef.current, width);
      tallRef.current = tall;
      wideRef.current = wide;
      setTier(tall ? 'full' : wide ? 'compact' : 'micro');
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(el);
    const rect = el.getBoundingClientRect();
    measure(rect.width, rect.height);

    return () => observer.disconnect();
  }, []);

  return [ref, tier];
}
