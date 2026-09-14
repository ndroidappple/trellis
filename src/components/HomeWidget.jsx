import { useLongPress } from '../hooks/useLongPress'
import { SCENES, groupByRoom, summaryFor } from '../lib/home'
import { Icon } from './homeIcons'
import './HomeWidget.css'

/**
 * Feature #18's board presence — Phase 2 of the widget-home-screen plan.
 * Lives inside a `WidgetTile` exactly like `ChoresPanel`/`ShoppingPanel`;
 * the tile's own head ("Home" + chevron) already opens the full room via
 * `WidgetTile`'s `onOpen`, so this component only needs `onOpenHome` for
 * the call sites *inside* its own body (the "+N more" row and a device
 * hold — see below).
 *
 * `size` is handed down from `Board.tsx`, computed from the widget's own
 * grid cell span — not a new generalized measurement hook. That's
 * `useWidgetSizeTier.ts`'s job (Phase 3), for generalizing To-Do/Shopping's
 * existing full/compact *setting* into something measured; Home has no
 * legacy setting to preserve, so a simple threshold on already-known cell
 * span is enough here and doesn't block Phase 3's later work.
 */

/** First N devices shown in the large tile before "+N more" takes over —
    first-guess, easy to retune; purely a content-density choice with no
    hardware dependency either way. */
const LARGE_DEVICE_CAP = 6

export default function HomeWidget({ devices, size, onToggle, onRunScene, onOpenHome }) {
  if (size === 'small') {
    return (
      <div className="home-widget home-widget--small">
        <p className="home-widget__summary">{summaryFor(devices)}</p>
      </div>
    )
  }

  const flat = groupByRoom(devices).flatMap(([, roomDevices]) => roomDevices)
  const shown = flat.slice(0, LARGE_DEVICE_CAP)
  const remaining = flat.length - shown.length

  return (
    <div className="home-widget home-widget--large">
      <div className="home-widget__scenes">
        {SCENES.map((scene) => (
          <button
            key={scene.id}
            type="button"
            className="home-widget__scene"
            aria-label={scene.name}
            onClick={() => onRunScene(scene)}
          >
            <Icon name={scene.icon} />
          </button>
        ))}
      </div>

      <div className="home-widget__grid">
        {shown.map((d) => (
          <HomeWidgetTile key={d.id} device={d} onToggle={onToggle} onOpen={onOpenHome} />
        ))}
      </div>

      {remaining > 0 && (
        <button type="button" className="home-widget__more" onClick={onOpenHome}>
          +{remaining} more
        </button>
      )}
    </div>
  )
}

/**
 * Tap toggles, same as the full room's own `HomeTile`. Hold opens the full
 * Home sheet rather than a dimmer scrim inline on a small, persistent board
 * tile — deliberate, not a shortcut taken: it matches this app's own "Hold
 * a thing to manage it" table (hold always reaches *the* management
 * surface for an object, not a miniature copy of it), and avoids a second
 * copy of HomeSheet's scrim+Dimmer markup that would need to stay in sync.
 */
function HomeWidgetTile({ device, onToggle, onOpen }) {
  const press = useLongPress(() => onOpen())

  return (
    <button
      type="button"
      className={`home-widget__tile${device.on ? ' on' : ''}`}
      aria-pressed={device.on}
      {...press.handlers}
      onClick={() => {
        if (press.consumeClick()) return
        onToggle(device.id)
      }}
    >
      <span
        className="home-widget__tile-fill"
        style={{ height: `${device.on ? (device.dimmable ? device.bright : 100) : 0}%` }}
        aria-hidden="true"
      />
      <span className="home-widget__tile-icon">
        <Icon name={device.icon} />
      </span>
      <span className="home-widget__tile-name">{device.name}</span>
    </button>
  )
}
