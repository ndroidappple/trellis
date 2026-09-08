import { Component } from 'react'

const RELOAD_MARK = 'trellis:last-auto-reload'
/** Never auto-reload more than once per this window — see below. */
const RELOAD_COOLDOWN_MS = 10 * 60 * 1000
const RELOAD_DELAY_MS = 6000

/**
 * Catches render errors so a crash doesn't leave a blank white rectangle on
 * the kitchen wall.
 *
 * Two things a wall device needs that a laptop doesn't:
 *
 *   1. The error text on screen. There are no devtools on a wall-mounted
 *      iPad, and nobody is going to attach Safari over USB to find out why
 *      the calendar went blank.
 *   2. Recovery without a human. A transient failure — a bad realtime frame,
 *      a hiccup mid-render — shouldn't need someone to walk over and tap.
 *      So it reloads itself once, then rate-limits: if it already
 *      auto-reloaded within the cooldown, the crash is evidently not
 *      transient and it stops, showing the error rather than flashing the
 *      screen every few seconds forever.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, reloading: false }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Still worth logging: someone may eventually attach a debugger.
    console.error('Trellis crashed:', error, info?.componentStack)

    let last = 0
    try {
      last = Number(localStorage.getItem(RELOAD_MARK)) || 0
    } catch {
      // Private mode or blocked storage — fall through to a manual reload.
    }

    if (Date.now() - last < RELOAD_COOLDOWN_MS) return

    try {
      localStorage.setItem(RELOAD_MARK, String(Date.now()))
    } catch {
      // If we can't record the attempt we can't rate-limit it, so don't
      // start an auto-reload we might repeat indefinitely.
      return
    }

    this.setState({ reloading: true })
    this.timer = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="shell">
        <div className="card">
          <h1>Trellis stopped</h1>
          <p className="muted">
            {this.state.reloading
              ? 'Reloading in a few seconds…'
              : 'It tried reloading already, so this one looks persistent.'}
          </p>
          <p className="error crash-detail">{String(this.state.error?.message ?? this.state.error)}</p>
          <button onClick={() => window.location.reload()}>Reload now</button>
        </div>
      </div>
    )
  }
}
