import { useEffect, useRef, useState } from 'react'
import './Screensaver.css'

/**
 * The face the wall wears most of the day: a trellis, slowly growing.
 *
 * The board gets looked at a few dozen times a day; this is what the room sees
 * the rest of the time, which inverts the usual priority — the "idle" screen is
 * really the primary visual surface of the product.
 *
 * The first version of this was four drifting fields of coloured light. It was
 * calm and it was anonymous: it could have been any app's screensaver. This one
 * is the thing the app is named after. A lattice fades up, vines climb it over
 * about four minutes, leaves open along the way, and then the whole thing
 * recedes and begins again somewhere slightly different.
 *
 * **It is also the harder shape to do safely, and that governs the design.** A
 * trellis is geometry — straight lines in fixed positions — which is precisely
 * what burns a display, and precisely what the board's own week rules and panel
 * edges already are. Three things keep it honest:
 *
 *   1. **Growth means most pixels are dark most of the time.** A vine spends
 *      the majority of each cycle not yet having reached where it is going.
 *   2. **Nothing survives the cycle.** Everything fades out completely and
 *      redraws, so no line is ever lit continuously.
 *   3. **The whole composition drifts and breathes** on a period share-prime
 *      with the growth, so successive cycles never land on the same pixels.
 *
 * Light pollution is the other half of the job: after 22:00 the scene drops to
 * something much closer to off than on, and slows further.
 *
 * It overlays the board rather than replacing it. Unmounting the board would
 * tear down five realtime subscriptions and the clock hook, and the wall would
 * come back showing a stale week.
 */
export default function Screensaver({ night, onWake }) {
  const [paused, setPaused] = useState(() => document.visibilityState !== 'visible')
  const wokenRef = useRef(false)
  const now = useClockMinute()

  /*
   * Stop animating entirely when nobody can see it.
   *
   * Browsers throttle offscreen animation but do not reliably stop it, and
   * this runs for hours a day on a device that must not get warm across a
   * multi-week uptime. Paused is also the correct state to *return* from: the
   * scene resumes where it left off rather than snapping to wherever the
   * timeline would have reached, so a wake never shows a jump.
   */
  useEffect(() => {
    function onVisibility() {
      setPaused(document.visibilityState !== 'visible')
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /*
   * Paint the browser canvas too, not just this element.
   *
   * `viewport-fit=cover` lets the page reach the physical edges, but the strip
   * behind the home indicator sits *outside* the initial containing block — so
   * a `position: fixed; inset: 0` overlay does not cover it, and on a Home
   * Screen web app it showed the iOS wallpaper while the rest of the screen
   * faded. Only a background on the root propagates there. Set as a data
   * attribute so the band follows the scene into night as well.
   */
  useEffect(() => {
    const root = document.documentElement
    root.dataset.saver = night ? 'night' : 'day'
    return () => { delete root.dataset.saver }
  }, [night])

  /**
   * Swallow the touch that wakes the wall.
   *
   * Same class of bug the long-press settings gesture already hit: one touch
   * meaning something to the wall and something else to the widget underneath
   * it. Dismissing the screensaver must not also tick the chore that happened
   * to be under the finger — and "under the finger" is likely, because the
   * finger goes wherever the hand was, not wherever the board is empty.
   *
   * `preventDefault` on the pointerdown suppresses the compatibility mouse
   * events, but a real click can still be synthesised, and by then this overlay
   * has unmounted and the board is back under the cursor. So the next click is
   * caught at the window in the capture phase — and released on a timer, since
   * a swipe or a cancelled touch ends in no click at all.
   */
  function handlePointerDown(e) {
    if (wokenRef.current) return
    wokenRef.current = true

    e.preventDefault()
    e.stopPropagation()

    function swallow(clickEvent) {
      clickEvent.preventDefault()
      clickEvent.stopPropagation()
      release()
    }

    function release() {
      clearTimeout(timer)
      window.removeEventListener('click', swallow, true)
    }

    const timer = setTimeout(release, 700)
    window.addEventListener('click', swallow, true)

    onWake()
  }

  return (
    <div
      className="saver"
      data-night={night ? 'true' : 'false'}
      data-paused={paused ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={0}
      aria-label="The board is resting. Touch anywhere to return to it."
    >
      {/*
        One SVG, scaled to cover. `preserveAspectRatio="xMidYMid slice"` is what
        lets a fixed 400×600 coordinate system fill a 1024×1366 wall without the
        lattice going oval — the drawing is designed once and cropped, rather
        than stretched to whatever shape the screen is.
      */}
      <svg
        className="saver__scene"
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g className="saver__grow">
          {/* The lattice. Drawn first and faintest — it is the thing being
              grown up, not the subject. */}
          <g className="saver__lattice">
            {LATTICE.map((d, i) => (
              <path key={i} d={d} style={{ '--i': i }} />
            ))}
          </g>

          {/* The vines. Each climbs over minutes via stroke-dashoffset, which
              is the whole trick: one property, animated on the compositor, and
              a line that appears to be drawn rather than to fade in. */}
          {VINES.map((v, i) => (
            <path key={i} className="saver__vine" d={v.d} style={{ '--i': i, '--len': v.len }} />
          ))}

          {/* Leaves open behind the growing tip, each delayed to roughly where
              its vine will have reached. */}
          {LEAVES.map((l, i) => (
            <ellipse
              key={i}
              className="saver__leaf"
              cx={l.x}
              cy={l.y}
              rx="5.5"
              ry="2.6"
              transform={`rotate(${l.r} ${l.x} ${l.y})`}
              style={{ '--i': i, '--at': l.at }}
            />
          ))}
        </g>
      </svg>

      {/*
        The time, which is most of what anyone wants from a screen across a
        room that is not currently showing them anything.
        
        It wanders. A clock parked in the middle of a wall-mounted panel for
        eight hours a day is the exact failure this whole scene is designed
        around — worse than the lattice, because digits are high-contrast and
        the colon never moves. So the position is derived from the minute
        itself: it is stable while a given minute is on screen and somewhere
        else on the next one, which over a day spreads the glyphs across a
        wide band of the panel and never animates to get there.
        
        Deriving it from the clock rather than running a CSS drift is also
        what makes it safe under `prefers-reduced-motion`, where the scene is
        switched off entirely and a CSS-drifted clock would either stop —
        parking it — or keep moving against the person's stated preference.
      */}
      <div className="saver__clock" style={wanderFor(now)} aria-hidden="true">
        {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- clock */

/**
 * The current time, re-read on the minute rather than on an interval that
 * happens to be sixty seconds long.
 *
 * Same reasoning as `useToday`'s midnight rollover: a naive
 * `setInterval(60_000)` started at :30 shows every minute half a minute late
 * for as long as the wall is up, and drifts further each time the iPad
 * suspends. This schedules to the next minute boundary and re-schedules from
 * whatever time it actually woke at, so a late tick corrects itself.
 */
function useClockMinute() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer

    function schedule() {
      const next = 60_000 - (Date.now() % 60_000)
      timer = setTimeout(() => {
        setNow(new Date())
        schedule()
      }, next + 50)
    }

    /*
     * An iPad that has been asleep comes back with its timers in whatever
     * state the OS left them, and a background tab has them throttled to
     * something far coarser than a minute. Both end the same way — the wall
     * lights up showing a time from some minutes ago, which is worse than
     * showing no time at all. So the clock is re-read on the way back, and
     * the schedule restarted from the real moment rather than resumed.
     */
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      setNow(new Date())
      clearTimeout(timer)
      schedule()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return now
}

/**
 * Where the clock sits this minute, as a percentage offset from centre.
 *
 * Two incommensurate sines over the minute-of-day, so the path does not
 * repeat within a day and consecutive minutes land well apart rather than
 * creeping. The excursion is large enough to matter for retention and small
 * enough that the clock never looks misplaced or reaches an edge.
 */
function wanderFor(date) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  return {
    '--wander-x': `${(Math.sin(minutes * 0.7) * 16).toFixed(2)}%`,
    '--wander-y': `${(Math.cos(minutes * 1.3) * 12).toFixed(2)}%`,
  }
}

/* ------------------------------------------------------------ the drawing */

/*
 * Generated rather than hand-listed, for one reason that matters: the leaves
 * have to sit *on* the vines. Typed out by hand they drift off by a few units
 * every time a curve is adjusted, and a leaf floating beside its stem is the
 * detail that makes the whole thing read as abstract shapes instead of a
 * plant. Here both come from the same function, so they cannot disagree.
 *
 * It runs once at module load — 6 vines at 60 samples is nothing — and the
 * output is a constant. No randomness anywhere: the wall should not draw a
 * subtly different trellis every time it wakes, and a seeded shuffle would be
 * a second thing to keep deterministic for no gain.
 *
 * The coordinate system is 400×600, close to the 3:4 of an iPad in portrait,
 * and `slice` crops rather than stretches — so everything is drawn fine and
 * dense enough to survive being scaled ~2.5× on the wall. The first version of
 * this was six lines and three vines at three times these stroke widths: at
 * wall scale it read as rope, not lattice.
 */

const H = 600
const W = 400

/** A diamond lattice: diagonals both ways, evenly spaced, run well past the
 *  edges so the crop never reveals an end. */
function buildLattice() {
  const out = []
  const step = 78
  for (let x = -260; x < W + 260; x += step) {
    out.push(`M ${x} ${H + 40} L ${x + 420} -40`)
    out.push(`M ${x} -40 L ${x + 420} ${H + 40}`)
  }
  return out
}

/**
 * A vine as a sine climbing the screen. `t` runs 0 (root, off the bottom) to 1
 * (tip, off the top), so a leaf at t and the path point at t are the same
 * place by construction.
 */
function vineAt(base, amp, freq, phase) {
  return (t) => ({
    x: base + amp * Math.sin(t * freq * Math.PI * 2 + phase),
    y: H + 30 - t * (H + 60),
  })
}

function buildVines() {
  // Offset bases and phases so no two climb in step — six identical sines
  // would read as a comb rather than as planting.
  const specs = [
    { base: 38, amp: 17, freq: 1.7, phase: 0.0 },
    { base: 106, amp: 13, freq: 2.1, phase: 1.1 },
    { base: 172, amp: 19, freq: 1.5, phase: 2.3 },
    { base: 238, amp: 14, freq: 2.3, phase: 0.6 },
    { base: 304, amp: 18, freq: 1.8, phase: 3.0 },
    { base: 366, amp: 12, freq: 2.0, phase: 1.8 },
  ]

  return specs.map((spec) => {
    const f = vineAt(spec.base, spec.amp, spec.freq, spec.phase)
    const pts = []
    for (let i = 0; i <= 60; i++) pts.push(f(i / 60))

    const d = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ')

    // Length, walked rather than trusted to a formula — the dash animation
    // needs a number at least as large as the real path or the line starts
    // partly drawn.
    let len = 0
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }

    return { d, len: Math.ceil(len) + 10, f }
  })
}

function buildLeaves(vines) {
  const out = []
  vines.forEach((v, vi) => {
    // Seven a vine, starting a little above the root so none sits off-screen
    // at the bottom, and stopping short of the tip so the growing end stays
    // bare — a stem always slightly ahead of its own foliage.
    for (let k = 0; k < 10; k++) {
      const t = 0.06 + (k / 10) * 0.86
      const p = v.f(t)
      // Alternate sides, and lean with the climb.
      const side = (vi + k) % 2 === 0 ? 1 : -1
      out.push({
        // Just enough to sit beside the stem rather than on it. Wider and
        // the leaf reads as floating next to the vine instead of growing off
        // it, which at wall distance is the difference between a plant and a
        // scatter of dots.
        x: +(p.x + side * 3.2).toFixed(1),
        y: +p.y.toFixed(1),
        r: side * (22 + ((k * 37) % 26)),
        // The fraction of the cycle by which the tip will have passed here.
        // 0.72 is where saver-climb finishes growing.
        at: +(t * 0.72).toFixed(3),
      })
    }
  })
  return out
}

const LATTICE = buildLattice()
const VINES = buildVines()
const LEAVES = buildLeaves(VINES)
