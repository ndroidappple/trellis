import { useState } from 'react'
import Sheet from './Sheet'
import { useLongPress } from '../hooks/useLongPress'
import { ROOMS, SCENES, groupByRoom, summaryFor } from '../lib/home'
import { Icon } from './homeIcons'
import './HomeSheet.css'

/**
 * Feature #18 — Home.
 *
 * A room, reached from Menu → Home, for controlling lights and other
 * household devices — the same tier as the recipe book, the to-do list and
 * shopping. See docs/feature-backlog.md for the full writeup; the short
 * version:
 *
 * **Implemented now:** everything you can see and touch here — room tabs,
 * scenes, a device grid grouped by room, tap-to-toggle, hold-to-dim (the
 * same gesture as a meal chip or a chore, via useLongPress). All of it runs
 * on `lib/home.js`'s mock device list — see the state note below.
 *
 * **Not implemented:** none of it controls anything real. There is no
 * Supabase table behind it — state resets to the mock defaults on reload,
 * and the wall and a phone would each show their own copy rather than the
 * synced state every other room in this app has. There is no connection to
 * Home Assistant (confirmed as the actual platform in play) or to the real
 * Sonos speaker. "Working…" on toggle is a fixed-delay UI flourish, not a
 * real optimistic-commit-then-reconcile against hardware that can fail —
 * home-layer.html (the prototype this borrowed the gesture from) modeled
 * that honestly with a pending/failed/retry cycle, and that machinery
 * belongs here once there is a real device that can actually be unreachable.
 * Wiring any of this to Home Assistant is future work, not started.
 *
 * Device state (`devices`, `onToggle`, `onSetBrightness`, `onRunScene`)
 * arrives as props now rather than living in this component's own
 * useState — lifted into `useMockHomeState` (Phase 2 of the widget-home-
 * screen plan) so the board's HomeWidget tile and this full room read and
 * write the same devices within a session, instead of the widget's toggles
 * vanishing the moment this sheet reopens and resets to defaults.
 */

function stateText(d) {
  if (d.pending) return 'Working…'
  if (!d.on) return 'Off'
  return d.dimmable ? `On · ${d.bright}%` : 'On'
}

function HomeTile({ device, onToggle, onOpenDimmer }) {
  const press = useLongPress(() => onOpenDimmer(device.id), { enabled: device.dimmable })

  return (
    <button
      className={`home-tile${device.on ? ' on' : ''}`}
      aria-pressed={device.on}
      {...press.handlers}
      onClick={() => {
        if (press.consumeClick()) return
        onToggle(device.id)
      }}
    >
      <span
        className="home-tile__fill"
        style={{ height: `${device.on ? (device.dimmable ? device.bright : 100) : 0}%` }}
        aria-hidden="true"
      />
      <span className="home-tile__icon">
        <Icon name={device.icon} />
      </span>
      <span className="home-tile__text">
        <span className="home-tile__name">{device.name}</span>
        <span className="home-tile__state">{stateText(device)}</span>
      </span>
    </button>
  )
}

export default function HomeSheet({ devices, onToggle, onSetBrightness, onRunScene, onClose }) {
  const [activeRoom, setActiveRoom] = useState('All')
  const [dimmingId, setDimmingId] = useState(null)

  const list = activeRoom === 'All' ? devices : devices.filter((d) => d.room === activeRoom)
  const groups = activeRoom === 'All' ? groupByRoom(devices) : [[activeRoom, list]]
  const dimming = devices.find((d) => d.id === dimmingId) ?? null

  return (
    <Sheet title="Home" subtitle={summaryFor(devices)} onClose={onClose}>
      <div className="home">
        <div className="home__rooms" role="tablist">
          <button
            className={`home__room${activeRoom === 'All' ? ' on' : ''}`}
            role="tab"
            aria-selected={activeRoom === 'All'}
            onClick={() => setActiveRoom('All')}
          >
            All
          </button>
          {ROOMS.map((room) => (
            <button
              key={room}
              className={`home__room${activeRoom === room ? ' on' : ''}`}
              role="tab"
              aria-selected={activeRoom === room}
              onClick={() => setActiveRoom(room)}
            >
              {room}
            </button>
          ))}
        </div>

        <div className="home__scenes">
          {SCENES.map((scene) => (
            <button key={scene.id} className="home__scene" onClick={() => onRunScene(scene)}>
              <Icon name={scene.icon} />
              {scene.name}
            </button>
          ))}
        </div>

        {groups.length === 0 ? (
          <div className="home__empty">
            <b>Nothing here yet</b>
            Add a device to this room from Settings.
          </div>
        ) : (
          groups.map(([room, roomDevices]) => (
            <div key={room}>
              {activeRoom === 'All' && <div className="home__group-label">{room}</div>}
              <div className="home__grid">
                {roomDevices.map((d) => (
                  <HomeTile key={d.id} device={d} onToggle={onToggle} onOpenDimmer={setDimmingId} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {dimming && (
        <div className="scrim" onClick={() => setDimmingId(null)}>
          <div className="card dialog home-dimmer-card" onClick={(e) => e.stopPropagation()}>
            <h2>{dimming.name}</h2>
            <p className="muted">{dimming.room}</p>
            <Dimmer device={dimming} onChange={(pct) => onSetBrightness(dimming.id, pct)} />
            <div className="chips">
              <button className="ghost" onClick={() => onToggle(dimming.id)}>
                {dimming.on ? 'Turn off' : 'Turn on'}
              </button>
              <button onClick={() => setDimmingId(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}

/** The vertical drag control inside the brightness dialog. */
function Dimmer({ device, onChange }) {
  const pct = device.on ? device.bright : 0

  function fromEvent(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const next = Math.round((1 - (e.clientY - box.top) / box.height) * 100)
    onChange(Math.max(1, Math.min(100, next)))
  }

  return (
    <div
      className={`home-dimmer${device.on ? '' : ' off'}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        fromEvent(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) fromEvent(e)
      }}
    >
      <div className="home-dimmer__fill" style={{ height: `${pct}%` }} />
      <div className="home-dimmer__pct">{device.on ? `${pct}%` : 'Off'}</div>
    </div>
  )
}
