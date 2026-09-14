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
 * with `.day-row--past` in WeekGrid.css) — it no longer competes for growth
 * beyond its own floor on equal terms with today or what's still ahead.
 * Everything else is 1.
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
 * Row floors, in sync with WeekGrid.css. A past row's floor is 44px —
 * deliberately below this app's own --tap-min (52px, tuned for an isolated
 * button) and pinned instead to Apple's HIG minimum tap target, since a
 * mis-tap on a run of day rows still opens *a* day rather than hitting
 * nothing. This is what makes several past days actually free real height
 * rather than only reweighting growth that, on a real iPad with the dock
 * already claiming most of the slack, turned out to be a few pixels per
 * row: see the incident this was built to fix, recorded in the feature
 * backlog.
 *
 * ORDINARY_ROW_MIN_HEIGHT and PAST_ROW_MIN_HEIGHT did not move for the 11"
 * retune, on purpose — both are anchored to a touch target (an event chip's
 * own 56px min-height, Apple's 44px HIG minimum) rather than to reading
 * distance, and fingers didn't get smaller when the screen did.
 * TODAY_ROW_MIN_HEIGHT did move: it's sized to the date rail, not a chip,
 * and the rail's numeral shrank from 78px to 60px (tokens.css
 * --size-dom-today-open) because that size existed only for wall-distance
 * legibility. Keep this in sync with .day-row--today in WeekGrid.css.
 */
const ORDINARY_ROW_MIN_HEIGHT = 84;
const TODAY_ROW_MIN_HEIGHT = 150;
export const PAST_ROW_MIN_HEIGHT = 44;
const GAP_PX = 7;

/**
 * The week grid's real minimum height for the days actually on screen —
 * replaces a static worst-case constant in Board.css, because that constant
 * assumed every non-today row needs 84px, which is no longer true once
 * several are past. A static floor sized for the worst case would force
 * `.board__week` to that height regardless of how many rows actually
 * collapsed, and the space freed by collapsing them would be reabsorbed by
 * the week grid's own flex-grow before it ever reached the dock.
 */
export function weekFloorFor(days: { isToday: boolean; isPast?: boolean }[]): number {
  const gaps = Math.max(0, days.length - 1) * GAP_PX;
  const rows = days.reduce(
    (sum, d) =>
      sum + (d.isToday ? TODAY_ROW_MIN_HEIGHT : d.isPast ? PAST_ROW_MIN_HEIGHT : ORDINARY_ROW_MIN_HEIGHT),
    0
  );
  return rows + gaps;
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
