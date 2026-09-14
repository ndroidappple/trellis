import type { CSSProperties, ReactNode, PointerEventHandler } from 'react';
import './WidgetTile.css';

export type WidgetMode = 'on' | 'off';

interface Props {
  id: string;
  title: string;
  /** "Three of six done", "8 to buy" — a status, not a label. Same idea as
      SectionPanel's `count`, which this replaces. */
  count?: string;
  mode: WidgetMode;
  children: ReactNode;
  /** Opens this widget's full page. Absent means the widget has no page —
      matches SectionPanel's `onOpen` exactly: the whole head is the door. */
  onOpen?: () => void;
  /** True only while the board is in "Rearrange widgets" mode (see
      MainMenu.jsx) — shows the drag handle and resize grip, and swaps the
      head's normal open-door button out so an accidental tap during
      rearranging can't also open the room underneath the drag. */
  rearranging?: boolean;
  onDragHandlePointerDown?: PointerEventHandler<HTMLButtonElement>;
  onResizeHandlePointerDown?: PointerEventHandler<HTMLButtonElement>;
  /** Live transform while this specific tile is mid-drag/resize — see
      WidgetGrid, which owns the gesture state this reads. */
  style?: CSSProperties;
  className?: string;
}

export function WidgetTile({
  id,
  title,
  count,
  mode,
  children,
  onOpen,
  rearranging,
  onDragHandlePointerDown,
  onResizeHandlePointerDown,
  style,
  className,
}: Props) {
  if (mode === 'off') return null;

  return (
    <section
      className={`widget-tile${className ? ` ${className}` : ''}`}
      data-widget={id}
      data-rearranging={rearranging ? 'true' : undefined}
      style={style}
    >
      <div className="widget-tile__head">
        {rearranging ? (
          <>
            {/* Rearranging swaps the door for a grip — the same reasoning
                ChecklistRow's badge split from its toggle button: two
                different actions cannot safely share one tap target when
                one of them is a drag. */}
            <button
              type="button"
              className="widget-tile__grip"
              aria-label={`Move ${title}`}
              onPointerDown={onDragHandlePointerDown}
            >
              <span aria-hidden="true">⠿</span>
            </button>
            <h2>{title}</h2>
          </>
        ) : onOpen ? (
          <button type="button" className="widget-tile__open" onClick={onOpen} aria-label={`Open ${title}`}>
            <h2>{title}</h2>
            {count && <span className="widget-tile__count">{count}</span>}
            <span className="widget-tile__chevron" aria-hidden="true">›</span>
          </button>
        ) : (
          <>
            <h2>{title}</h2>
            {count && <span className="widget-tile__count">{count}</span>}
          </>
        )}
      </div>

      <div className="widget-tile__body" aria-hidden={rearranging ? true : undefined} inert={rearranging ? true : undefined}>
        {children}
      </div>

      {rearranging && (
        <button
          type="button"
          className="widget-tile__resize"
          aria-label={`Resize ${title}`}
          onPointerDown={onResizeHandlePointerDown}
        >
          <span aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
