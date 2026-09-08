import './Skeleton.css';

/**
 * Placeholder shapes for the first paint, before Supabase has answered.
 *
 * The board used to render its empty state during that gap, so a cold start
 * — a router reboot, a morning wake — briefly asserted "Nothing planned" on
 * a week that was actually full. On a wall that reads as fact, not as
 * loading, and it's the one lie the board can tell without anyone noticing.
 *
 * These occupy the same space the real content will, so nothing jumps when
 * the data lands.
 */
export function SkeletonBar({ width = '100%', height = 20 }: {
  width?: string | number;
  height?: number;
}) {
  return <span className="skeleton-bar" style={{ width, height }} aria-hidden="true" />;
}

/** A day's worth of placeholder chips. */
export function SkeletonChips({ count = 1 }: { count?: number }) {
  return (
    <div className="skeleton-chips" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="skeleton-chip" />
      ))}
    </div>
  );
}

/** Placeholder rows for a section panel. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-row">
          <span className="skeleton-box" />
          {/* Uneven widths: a stack of identical bars reads as a broken
              layout, varied ones read as text that hasn't arrived. */}
          <SkeletonBar width={`${64 - i * 9}%`} height={18} />
        </div>
      ))}
    </div>
  );
}
