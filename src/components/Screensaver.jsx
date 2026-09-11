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
              rx={LEAF_RX}
              ry="2.6"
              transform={`rotate(${l.r} ${l.x} ${l.y})`}
              style={{ '--vi': l.vi, '--at': l.at }}
            />
          ))}
        </g>
      </svg>

      {/*
        The time, which is most of what anyone wants from a screen across a
        room that is not currently showing them anything.
        
        Centred, and it stays centred. The first version moved it to a new spot
        each minute — a genuine attempt at the burn-in problem, and the wrong
        shape for it: a discrete jump is the one kind of movement the eye
        cannot miss, so the clock read as unplaced rather than as protected.
        A slow continuous drift solves the same problem invisibly. It is a
        couple of viewport units over six and a half minutes, which no glance
        resolves as motion and no reference on screen can be measured against,
        and it still means no pixel holds a digit for long.
      */}
      <div className="saver__clock" aria-hidden="true">
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

/**
 * The easing `saver-climb` grows with, solved forwards and backwards.
 *
 * This exists because a leaf has to know *when* its own stem tip will reach
 * it, and the obvious answer — the fraction of the way up it sits, times the
 * 0.72 of the cycle the climb takes — is only right if the climb is linear.
 * It is not: the vines grow on `cubic-bezier(0.35, 0, 0.45, 1)`, which is slow
 * off the mark and fast through the middle. Timing the leaves as though it
 * were linear opened each one up to a tenth of a stem-length ahead of the tip
 * that was supposed to have grown past it — a leaf hanging just above the end
 * of its own branch, which is exactly the thing that reads as detached.
 */
function cubicBezierEase(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const atX = (t) => ((ax * t + bx) * t + cx) * t
  const atY = (t) => ((ay * t + by) * t + cy) * t

  return (x) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (atX(mid) < x) lo = mid
      else hi = mid
    }
    return atY((lo + hi) / 2)
  }
}

const CLIMB_EASE = cubicBezierEase(0.35, 0, 0.45, 1)

/** The inverse: how far into the climb the tip has covered `progress` of it. */
function climbPhaseFor(progress) {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (CLIMB_EASE(mid) < progress) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

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
    const cumulative = [0]
    for (let i = 1; i < pts.length; i++) {
      cumulative.push(
        cumulative[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      )
    }
    const len = cumulative[cumulative.length - 1]

    /*
     * How far along the *drawn line* a given `t` sits, which is not `t`.
     * `stroke-dashoffset` counts path length, and a sine covers more path per
     * unit of t where it leans than where it runs straight — so a leaf placed
     * by parameter and timed by parameter disagree with the tip, which is
     * placed by length.
     */
    const arcFrac = (t) => {
      const i = Math.min(pts.length - 2, Math.max(0, Math.floor(t * (pts.length - 1))))
      const span = 1 / (pts.length - 1)
      const within = Math.min(1, Math.max(0, (t - i * span) / span))
      return (cumulative[i] + (cumulative[i + 1] - cumulative[i]) * within) / len
    }

    return { d, len: Math.ceil(len) + 10, f, arcFrac }
  })
}

/** Ellipse radii, shared with the CSS that draws them. */
const LEAF_RX = 5.5

/**
 * How far a leaf's centre sits off the stem, and how far its long axis leans
 * away from the direction of climb.
 *
 * These two are a pair and must be read together. The leaf reaches
 * `LEAF_RX * cos(LEAN)` back towards the stem along its own axis, so as long
 * as that exceeds `LEAF_OFFSET` the inner end of every leaf crosses the
 * centreline of its vine and the two are visibly joined. At 5.5 × cos(48°) =
 * 3.68 against an offset of 2.0, every leaf overlaps the stem by about 1.7
 * units — a little over five pixels once the scene is scaled onto the wall,
 * which is what makes it read as growing off the stem rather than floating
 * beside it.
 */
const LEAF_OFFSET = 2.0
const LEAN_DEG = 48

/** How far behind the growing tip a leaf opens, in cycle fractions. */
const LEAF_LAG = 0.02

/**
 * Leaves, attached to their stems by construction.
 *
 * The first version offset each leaf a flat 3.2 units in *x* and rotated it by
 * a number derived from its index. Both were wrong in the same way: they
 * ignored the stem. A vine is a sine, so it is near-vertical in places and
 * leaning hard in others — and a horizontal offset against a leaning stem puts
 * the leaf out in open space, while a rotation unrelated to the stem's
 * direction points it wherever the arithmetic happened to land. On the parts
 * of a vine that lean most, the two errors compound and the leaf detaches
 * completely.
 *
 * So both now come from the curve itself. The tangent is taken by finite
 * difference on the same `f` that draws the path, the leaf is offset along the
 * perpendicular to it, and its long axis is the direction of climb rotated
 * `LEAN_DEG` off the stem — so a leaf on a leaning stem leans with it.
 */
function buildLeaves(vines) {
  const out = []
  const lean = (LEAN_DEG * Math.PI) / 180

  vines.forEach((v, vi) => {
    // Ten a vine, starting a little above the root so none sits off-screen at
    // the bottom, and stopping short of the tip so the growing end stays bare
    // — a stem always slightly ahead of its own foliage.
    for (let k = 0; k < 10; k++) {
      const t = 0.06 + (k / 10) * 0.86
      const p = v.f(t)
      const side = (vi + k) % 2 === 0 ? 1 : -1

      // The stem's own direction here, pointing up the climb.
      const back = v.f(Math.max(0, t - 0.004))
      const fwd = v.f(Math.min(1, t + 0.004))
      const len = Math.hypot(fwd.x - back.x, fwd.y - back.y) || 1
      const ux = (fwd.x - back.x) / len
      const uy = (fwd.y - back.y) / len

      // Perpendicular to it, on this leaf's side.
      const nx = -uy * side
      const ny = ux * side

      out.push({
        x: +(p.x + nx * LEAF_OFFSET).toFixed(2),
        y: +(p.y + ny * LEAF_OFFSET).toFixed(2),
        r: +(((Math.atan2(uy, ux) + lean * side) * 180) / Math.PI).toFixed(1),
        // Which vine this grew on. The stems are staggered against each other
        // by -9s each, and a leaf that does not carry the same stagger opens
        // at a moment its own stem has not reached — which is the other half
        // of looking detached.
        vi,
        /*
         * The fraction of the cycle by which the tip will have passed here.
         * 0.72 is where saver-climb finishes growing; the phase inside that is
         * solved through the easing rather than assumed linear, and measured
         * along the path rather than in the curve's parameter — the tip is a
         * dash offset, so both corrections are needed to meet it.
         *
         * LEAF_LAG puts the leaf a little behind the tip rather than exactly
         * on it, which is both safer and truer: a stem is always slightly
         * ahead of its own foliage.
         */
        at: +(climbPhaseFor(v.arcFrac(t)) * 0.72 + LEAF_LAG).toFixed(3),
      })
    }
  })
  return out
}

const LATTICE = buildLattice()
const VINES = buildVines()
const LEAVES = buildLeaves(VINES)
