import type { CSSProperties, ReactNode } from 'react';
import type { PointerEventHandler } from 'react';
import { useLongPress } from '../hooks/useLongPress';
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
      matches SectionPanel's `onOpen` exactly: the whole head is the door.
      Calendar has none (it's already the main view), which is why the size
      long-press below can't only live on the onOpen button. */
  onOpen?: () => void;
  /** Opens this widget's size menu (Small/Medium/Large, whichever this
      widget defines — see SIZE_PRESETS). Works on the resting head, not
      gated behind "Rearrange widgets" — that mode still exists, but only
      for repositioning now. Not offered while rearranging: the head is
      already the drag grip then, and a long press on the same element
      starting a drag can't also mean "open a menu instead" without the kind
      of gesture ambiguity that's already broken real touch here once. */
  onLongPress?: () => void;
  /** True only while the board is in "Rearrange widgets" mode (see
      MainMenu.jsx) — shows the drag handle and swaps the head's normal
      open-door button out so an accidental tap during rearranging can't
      also open the room underneath the drag. */
  rearranging?: boolean;
  onDragHandlePointerDown?: PointerEventHandler<HTMLButtonElement>;
  /** Live transform while this specific tile is mid-drag — see WidgetGrid,
      which owns the gesture state this reads. */
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
  onLongPress,
  rearranging,
  onDragHandlePointerDown,
  style,
  className,
}: Props) {
  const press = useLongPress(onLongPress, { enabled: !rearranging });

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
          <button
            type="button"
            className="widget-tile__open"
            aria-label={`Open ${title}`}
            {...press.handlers}
            onClick={() => {
              if (press.consumeClick()) return;
              onOpen();
            }}
          >
            <h2>{title}</h2>
            {count && <span className="widget-tile__count">{count}</span>}
            <span className="widget-tile__chevron" aria-hidden="true">›</span>
          </button>
        ) : (
          // Calendar's case: no page to open, but still resizable — the
          // long press has nowhere else to live.
          <div className="widget-tile__head-plain" {...press.handlers} onClick={() => press.consumeClick()}>
            <h2>{title}</h2>
            {count && <span className="widget-tile__count">{count}</span>}
          </div>
        )}
      </div>

      <div className="widget-tile__body" aria-hidden={rearranging ? true : undefined} inert={rearranging ? true : undefined}>
        {children}
      </div>
    </section>
  );
}
