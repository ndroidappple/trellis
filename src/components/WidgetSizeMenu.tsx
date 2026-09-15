import './WidgetSizeMenu.css';

export interface SizePreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

interface Props {
  /** The widget's own title ("Weekly To Do", "This Week"), so the menu
      reads as "sizing this specific thing" rather than a generic dialog. */
  title: string;
  presets: SizePreset[];
  currentId: string | null;
  /** Presets that don't fit at this tile's current position right now —
      shown disabled rather than omitted, same as SettingsSheet's flourish
      picker ("the reason a chip is unavailable is that it goes quiet
      rather than rejects the tap"). Never disables `currentId` itself: a
      tile is always a valid size where it already is. */
  disabledIds: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}

export function WidgetSizeMenu({ title, presets, currentId, disabledIds, onPick, onClose }: Props) {
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="size-menu"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} size`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="size-menu__title">{title}</h2>
        <p className="size-menu__hint">Choose a size</p>

        <div className="size-menu__options">
          {presets.map((preset) => {
            const isCurrent = preset.id === currentId;
            const disabled = !isCurrent && disabledIds.includes(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                className={`size-menu__option${isCurrent ? ' is-current' : ''}`}
                disabled={disabled}
                onClick={() => (isCurrent ? onClose() : onPick(preset.id))}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <button type="button" className="size-menu__close" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
