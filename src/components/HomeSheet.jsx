import { useState } from 'react'
import Sheet from './Sheet'
import { useLongPress } from '../hooks/useLongPress'
import { ROOMS, INITIAL_DEVICES, SCENES, applyScene, groupByRoom, summaryFor } from '../lib/home'
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
 * on `lib/home.js`'s mock device list, held in this component's own state.
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
 */

const TOGGLE_DELAY_MS = 260

const ICON_PATHS = {
  lamp: <path d="M9 2h6l3 7H6l3-7zm3 9v7m-3 3h6" />,
  ceiling: <path d="M12 2v4m-7 7a7 7 0 0 1 14 0H5zm3 3h8" />,
  strip: <path d="M3 8h18v4H3zM7 12v4m5-4v4m5-4v4" />,
  plug: <path d="M9 2v6m6-6v6M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8zm6 9v5" />,
  fan: (
    <path
      strokeWidth="1.6"
      d="M12 12c0-4 2-6 4-5s1 5-4 5zm0 0c4 0 6 2 5 4s-5 1-5-4zm0 0c0 4-2 6-4 5s-1-5 4-5zm0 0c-4 0-6-2-5-4s5-1 5 4z"
    />
  ),
  speaker: <path strokeWidth="1.8" d="M6 3h12v18H6zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z" />,
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M8 5v14" />
    </>
  ),
  pot: <path d="M4 9h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9zM8 6V4m4 2V4m4 2V4" />,
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {ICON_PATHS[name]}
    </svg>
  )
}

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

export default function HomeSheet({ onClose }) {
  const [devices, setDevices] = useState(INITIAL_DEVICES)
  const [activeRoom, setActiveRoom] = useState('All')
  const [dimmingId, setDimmingId] = useState(null)

  const list = activeRoom === 'All' ? devices : devices.filter((d) => d.room === activeRoom)
  const groups = activeRoom === 'All' ? groupByRoom(devices) : [[activeRoom, list]]
  const dimming = devices.find((d) => d.id === dimmingId) ?? null

  function patch(id, next) {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...next } : d)))
  }

  // A brief "Working…" between tap and effect, the same idea as a real
  // optimistic commit (see the doc comment above) without the reconcile —
  // there's nothing on the other end yet that could disagree with this.
  function toggle(id) {
    const d = devices.find((x) => x.id === id)
    if (!d || d.pending) return
    const willBeOn = !d.on
    patch(id, { pending: true })
    setTimeout(() => {
      patch(id, { pending: false, on: willBeOn, bright: willBeOn && d.bright < 5 ? 100 : d.bright })
    }, TOGGLE_DELAY_MS)
  }

  function setBrightness(id, bright) {
    patch(id, { on: true, bright })
  }

  function runScene(scene) {
    setDevices((prev) => applyScene(prev, scene))
  }

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
            <button key={scene.id} className="home__scene" onClick={() => runScene(scene)}>
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
                  <HomeTile key={d.id} device={d} onToggle={toggle} onOpenDimmer={setDimmingId} />
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
            <Dimmer device={dimming} onChange={(pct) => setBrightness(dimming.id, pct)} />
            <div className="chips">
              <button className="ghost" onClick={() => toggle(dimming.id)}>
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
