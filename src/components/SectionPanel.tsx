import type { ReactNode } from 'react';
import './SectionPanel.css';

export type SectionMode = 'full' | 'compact' | 'off';

interface PanelProps {
  title: string;
  /** "Three of six done", "8 to buy" — a status, not a label. */
  count?: string;
  mode: SectionMode;
  /** Shown at full. */
  children: ReactNode;
  /** Shown at compact. Not a shrunken `children` — a different thing. */
  compact?: ReactNode;
  /** Opens this section's full page. Absent means the section has no page. */
  onOpen?: () => void;
}

export function SectionPanel({ title, count, mode, children, compact, onOpen }: PanelProps) {
  if (mode === 'off') return null;

  return (
    <section className={`section-panel section-panel--${mode}`}>
      {/* The whole head is the door, not a separate chevron. It is the one
          strip of the panel that is not already a control, it is the largest
          target the panel has, and a title that opens the thing it titles
          needs no explaining. The count rides along inside it so the head
          keeps reading as a status line rather than as a button. */}
      <div className="section-panel__head">
        {onOpen ? (
          <button
            type="button"
            className="section-panel__open"
            onClick={onOpen}
            aria-label={`Open ${title}`}
          >
            <h2>{title}</h2>
            {count && <span className="section-panel__count">{count}</span>}
            <span className="section-panel__chevron" aria-hidden="true">›</span>
          </button>
        ) : (
          <>
            <h2>{title}</h2>
            {count && <span className="section-panel__count">{count}</span>}
          </>
        )}
      </div>
      {mode === 'full' ? children : compact}
    </section>
  );
}

/**
 * Two columns only when both panels are full. A compact panel is a full-width
 * strip — a 112px-tall half-width box is an awkward shape and reads as a
 * mistake.
 */
export function SectionDock({ modes, children }: {
  modes: SectionMode[];
  children: ReactNode;
}) {
  const on = modes.filter((m) => m !== 'off');
  if (on.length === 0) return null;

  const cols = on.length === 2 && on.every((m) => m === 'full') ? 2 : 1;

  return (
    // `data-stack` is how many panels are actually on. Two panels stacked in
    // one column ask for more height than the board has left once the week
    // grid takes its floor, so the CSS uses this to shorten a full panel in
    // that arrangement rather than let it be clipped.
    <div className="section-dock" data-cols={cols} data-stack={on.length}>
      {children}
    </div>
  );
}
