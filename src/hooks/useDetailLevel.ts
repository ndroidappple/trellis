import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * How much detail the board shows about each event.
 *
 *   tight — title and time only; extra events collapse to "+N more"
 *   mid   — every event visible, nothing collapsed, slightly larger text
 *   open  — a third line of detail appears; sparse days say so
 *
 * Derived from measured space rather than from settings, so a heavy week and a
 * light week get different treatment at identical settings.
 */
export type DetailLevel = 'tight' | 'mid' | 'open';

/**
 * Today's row is flex: 2.4. A past row is PAST_ROW_WEIGHT (keep this in sync
 * with `.day-row--past` in WeekGrid.css) — it still has the same 84px floor
 * as any other row, it just no longer competes for growth beyond that floor
 * on equal terms with today or what's still ahead. Everything else is 1.
 *
 * The total varies with how many days in view are past, which is why this is
 * a function of the actual days rather than a constant: a week with nobody
 * past yet (Sunday) and a week that's mostly gone (Saturday) distribute their
 * real height differently, and dividing by a fixed 8.4 regardless would
 * misjudge the height of an ordinary row in both directions.
 */
const PAST_ROW_WEIGHT = 0.4;

export function weightedRowsFor(days: { isToday: boolean; isPast?: boolean }[]): number {
  return days.reduce(
    (sum, d) => sum + (d.isToday ? 2.4 : d.isPast ? PAST_ROW_WEIGHT : 1),
    0
  );
}

/**
 * Separate enter and exit thresholds. The gap between them is the hysteresis
 * band — without it, adding one event can put a row on the boundary and the
 * whole board flickers between levels as it reflows.
 */
const ENTER_MID = 112;
const EXIT_MID = 98;
const ENTER_OPEN = 140;
const EXIT_OPEN = 126;

function nextLevel(current: DetailLevel, rowHeight: number): DetailLevel {
  switch (current) {
    case 'tight':
      return rowHeight >= ENTER_MID ? (rowHeight >= ENTER_OPEN ? 'open' : 'mid') : 'tight';
    case 'mid':
      if (rowHeight >= ENTER_OPEN) return 'open';
      if (rowHeight < EXIT_MID) return 'tight';
      return 'mid';
    case 'open':
      if (rowHeight < EXIT_OPEN) return rowHeight < EXIT_MID ? 'tight' : 'mid';
      return 'open';
  }
}

/**
 * Watches the week container and reports how much detail it can afford.
 * Attach the returned ref to the element that wraps the seven day rows.
 *
 * `weightedRows` (from `weightedRowsFor`) is a dependency, not just an input:
 * the container's own height doesn't necessarily change when a day rolls from
 * today to past at midnight, or when paging to a different week, but the real
 * height of an *ordinary* row does — so the effect has to re-measure, not
 * just recompute, whenever the weighting changes.
 */
export function useDetailLevel(weightedRows: number): [RefObject<HTMLDivElement | null>, DetailLevel] {
  const ref = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState<DetailLevel>('tight');
  const levelRef = useRef<DetailLevel>('tight');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (height: number) => {
      const rowHeight = height / weightedRows;
      const next = nextLevel(levelRef.current, rowHeight);
      if (next !== levelRef.current) {
        levelRef.current = next;
        setLevel(next);
      }
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.height);
    });

    observer.observe(el);
    measure(el.getBoundingClientRect().height);

    return () => observer.disconnect();
  }, [weightedRows]);

  return [ref, level];
}

/** How many chips a day row shows before collapsing the rest into "+N more". */
export function visibleChipCount(level: DetailLevel): number {
  return level === 'tight' ? 2 : Number.POSITIVE_INFINITY;
}
