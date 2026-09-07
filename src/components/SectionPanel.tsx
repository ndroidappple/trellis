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
}

export function SectionPanel({ title, count, mode, children, compact }: PanelProps) {
  if (mode === 'off') return null;

  return (
    <section className={`section-panel section-panel--${mode}`}>
      <div className="section-panel__head">
        <h2>{title}</h2>
        {count && <span className="section-panel__count">{count}</span>}
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
    <div className="section-dock" data-cols={cols}>
      {children}
    </div>
  );
}
