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
        lets a fixed 400×600 coordinate system fill the 834×1194 counter dock
        (or 1194×834 turned sideways — `slice` doesn't care, it crops to
        whatever shape the screen is) without the lattice going oval — the
        drawing is designed once and cropped, rather than stretched.
      */}
      <svg
        className="saver__scene"
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/*
            Both gradients are in objectBoundingBox units, which is what makes
            one definition serve every element that uses it: the leaf gradient
            orients itself to each leaf's own box rather than to the canvas, so
            seventy-eight leaves at seventy-eight angles each get light across
            their own width. Stops take their colour from the same custom
            properties as everything else, so night still costs one class.
          */}
          <linearGradient id="saver-stem" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" className="saver__stop--stem-root" />
            <stop offset="1" className="saver__stop--stem-tip" />
          </linearGradient>

          <linearGradient id="saver-leaf" x1="0" y1="0" x2="0.55" y2="1">
            <stop offset="0" className="saver__stop--leaf-lit" />
            <stop offset="1" className="saver__stop--leaf-deep" />
          </linearGradient>
        </defs>

        <g className="saver__grow">
          {/* The lattice, in two directions at two weights so one set reads as
              sitting behind the other. Drawn first and faintest — it is the
              thing being grown up, not the subject. */}
          <g className="saver__lattice saver__lattice--back">
            {LATTICE.back.map((l, i) => (
              <path key={i} d={l.d} style={{ opacity: l.dim, '--i': i }} />
            ))}
          </g>
          <g className="saver__lattice saver__lattice--front">
            {LATTICE.front.map((l, i) => (
              <path key={i} d={l.d} style={{ opacity: l.dim, '--i': i }} />
            ))}
          </g>

          {/*
            One group per plant, and the growth lives on the group.

            The stem used to grow by `stroke-dashoffset` and each leaf had to be
            told, in cycle fractions, when its own tip would arrive — a number
            that had to survive the easing, the path-length-versus-parameter
            difference, and the per-vine stagger, and did not. Clipping the
            group instead makes the reveal one line that rises through stem and
            foliage together. There is no timing to get wrong because there is
            no second clock.
          */}
          {PLANTS.map((plant, i) => (
            <g key={i} className="saver__plant" style={{ '--i': i }}>
              <path className="saver__vine" d={plant.outline} />
              {plant.leaves.map((leaf, k) => (
                <path
                  key={k}
                  className="saver__leaf"
                  d={leaf.d}
                  transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}
                />
              ))}
            </g>
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
 * It runs once at module load — six vines at 160 samples is nothing — and the
 * output is a constant. No randomness anywhere: the wall should not draw a
 * subtly different trellis every time it wakes, and a seeded shuffle would be
 * a second thing to keep deterministic for no gain. Where variety is wanted,
 * it comes from index arithmetic, which is varied *and* fixed.
 *
 * The coordinate system is 400×600, close to the 3:4 of an iPad in portrait,
 * and `slice` crops rather than stretches — so everything is drawn fine and
 * dense enough to survive being scaled ~2.5× on the wall.
 */

const H = 600
const W = 400
const TAU = Math.PI * 2

/* ------------------------------------------------------------- the lattice */

/**
 * A diamond lattice, in two directions kept apart.
 *
 * It was one flat set of identical lines, which is what a grid looks like
 * rather than what a trellis looks like. A real trellis is slats crossing
 * slats, and at every crossing one of them is in front. Splitting the two
 * directions into their own groups at different weights is not a weave — a
 * true weave would need the over/under to alternate at each crossing — but it
 * is the thing a weave reads as from across a room: one set sitting behind the
 * other.
 *
 * The per-line opacity jitter matters as much. Identical lines at identical
 * spacing read as printed graph paper; varying them a little reads as timber,
 * which is not evenly stained.
 */
function buildLattice() {
  const step = 78
  const back = []
  const front = []
  let n = 0

  for (let x = -260; x < W + 260; x += step) {
    // Deterministic variety: the same line is always the same weight.
    back.push({ d: `M ${x} ${H + 40} L ${x + 420} -40`, dim: 0.62 + ((n * 37) % 34) / 100 })
    front.push({ d: `M ${x} -40 L ${x + 420} ${H + 40}`, dim: 0.7 + ((n * 53) % 30) / 100 })
    n += 1
  }

  return { back, front }
}

/* --------------------------------------------------------------- the vines */

/**
 * The half-width of a stem at height `t`, which is what turns a line into a
 * plant.
 *
 * A stroked path is one width everywhere, and a stem that is as thick at its
 * tip as at its root reads as wire — which is most of why the first version
 * of this looked drawn rather than grown. The vines are now filled outlines:
 * two edges walked at ±this distance from the centreline and closed into a
 * shape, so they can start heavy at the soil and end at almost nothing.
 *
 * The 1.5 exponent keeps the thickness low for most of the climb and puts the
 * taper into the bottom quarter, which is where a real stem does its
 * thickening.
 */
const STEM_BASE_W = 2.0
const STEM_TIP_W = 0.24

function stemHalfWidth(t) {
  return STEM_TIP_W + (STEM_BASE_W - STEM_TIP_W) * Math.pow(1 - t, 1.5)
}

/**
 * A vine as a curve climbing the screen. `t` runs 0 (root, off the bottom) to
 * 1 (tip, off the top), so a leaf at t and the path point at t are the same
 * place by construction.
 *
 * Three things were added to a plain sine, and each fixes a way the plain sine
 * looked mechanical:
 *
 *   - **A second harmonic**, so the curve is not the same shape repeated. One
 *     sine has exactly one gesture in it; two incommensurate ones have no
 *     repeating unit at this length.
 *   - **Amplitude that grows with height.** A stem is held firm near the soil
 *     and waves more freely the further it gets, so a constant-amplitude
 *     wobble at the root looks like a spring rather than a plant.
 *   - **A lateral drift**, squared so it barely acts low down, which stops all
 *     six vines climbing in parallel columns.
 */
function vineAt({ base, amp, freq, phase, drift }) {
  return (t) => {
    const a = amp * (0.4 + 0.6 * t)
    return {
      x:
        base +
        a * Math.sin(t * freq * TAU + phase) +
        a * 0.32 * Math.sin(t * freq * 2.6 * TAU + phase * 1.9) +
        drift * t * t,
      y: H + 30 - t * (H + 60),
    }
  }
}

/** The unit tangent at `t`, by finite difference on the curve itself. */
function tangentAt(f, t) {
  const back = f(Math.max(0, t - 0.003))
  const fwd = f(Math.min(1, t + 0.003))
  const len = Math.hypot(fwd.x - back.x, fwd.y - back.y) || 1
  return { x: (fwd.x - back.x) / len, y: (fwd.y - back.y) / len }
}

/**
 * The stem as a closed shape: up one edge, back down the other.
 *
 * 160 samples rather than the 60 the stroked version used. A filled outline
 * shows its own faceting where a stroke would have hidden it under a round
 * linecap, and this is scaled 2.5× onto a wall.
 */
function outlineFor(f, samples = 160) {
  const left = []
  const right = []

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = f(t)
    const u = tangentAt(f, t)
    const hw = stemHalfWidth(t)
    left.push([p.x - u.y * hw, p.y + u.x * hw])
    right.push([p.x + u.y * hw, p.y - u.x * hw])
  }

  const at = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`
  return (
    `M ${at(left[0])} ` +
    left.slice(1).map((q) => `L ${at(q)}`).join(' ') +
    ' ' +
    right.reverse().map((q) => `L ${at(q)}`).join(' ') +
    ' Z'
  )
}

/* -------------------------------------------------------------- the leaves */

/** How long a leaf is at the root, before the taper with height. */
const LEAF_LEN = 11

/** How far its long axis leans off the direction of climb. */
const LEAN_DEG = 46

/**
 * One leaf, drawn from its own base at the origin out along +x.
 *
 * It was an `<ellipse>`, which is the shape of a leaf only in the sense that
 * both are roundish. A leaf is asymmetric along its length: full and rounded
 * where it meets the stem, drawn out to a point at the far end. Two cubics
 * give exactly that and cost no more to render.
 *
 * Drawing it from the base rather than the centre is the other half of this.
 * The old version centred an ellipse *beside* the stem and hoped the overlap
 * held; this one starts inside the stem and grows outward, so attachment is a
 * property of the geometry rather than something to be verified afterwards.
 */
function leafPath(len, wid) {
  return (
    `M 0 0 ` +
    `C ${(len * 0.16).toFixed(2)} ${(-wid).toFixed(2)} ` +
    `${(len * 0.62).toFixed(2)} ${(-wid * 0.9).toFixed(2)} ` +
    `${len.toFixed(2)} 0 ` +
    `C ${(len * 0.62).toFixed(2)} ${(wid * 0.9).toFixed(2)} ` +
    `${(len * 0.16).toFixed(2)} ${wid.toFixed(2)} 0 0 Z`
  )
}

const LEAVES_PER_VINE = 17

/**
 * How far a leaf's angle may wander off the nominal lean, in degrees.
 *
 * Every leaf sitting at exactly LEAN_DEG is the giveaway that a plant was
 * generated rather than grown — real foliage turns toward whatever light it
 * found. Deterministic per leaf, so the same leaf always sits the same way.
 */
const LEAN_JITTER_DEG = 15

function leavesFor(f, vi) {
  const lean = (LEAN_DEG * Math.PI) / 180
  const out = []

  for (let k = 0; k < LEAVES_PER_VINE; k++) {
    const t = 0.05 + (k / LEAVES_PER_VINE) * 0.88
    const p = f(t)
    const u = tangentAt(f, t)
    const side = (vi + k) % 2 === 0 ? 1 : -1

    // Base sits just inside the stem's own surface, so the leaf emerges from
    // the wood rather than touching it.
    const hw = stemHalfWidth(t)
    const nx = -u.y * side
    const ny = u.x * side

    // Bigger low on the plant and smaller toward the tip, with a little
    // deterministic variation so no two are stamped from the same die.
    const size = LEAF_LEN * (1.12 - 0.48 * t) * (0.82 + ((k * 29) % 34) / 100)

    // Two different multipliers so the jitter does not fall into step with
    // the size variation above and produce a visible repeating pair.
    const jitter = (((k * 41 + vi * 17) % 31) / 30 - 0.5) * 2 * LEAN_JITTER_DEG

    out.push({
      d: leafPath(size, size * 0.33),
      x: +(p.x + nx * hw * 0.55).toFixed(2),
      y: +(p.y + ny * hw * 0.55).toFixed(2),
      r: +(
        ((Math.atan2(u.y, u.x) + lean * side) * 180) / Math.PI +
        jitter * side
      ).toFixed(1),
    })
  }

  return out
}

/* --------------------------------------------------------------- assembled */

/**
 * A plant is a stem and its own leaves, kept together.
 *
 * They used to be two flat lists, which is how a leaf came to be timed against
 * a stem it did not belong to. Grouping them means the reveal applies to both
 * at once — see `.saver__plant` — and the whole class of "foliage without a
 * branch" bug stops being something to get right and starts being something
 * that cannot be expressed.
 */
function buildPlants() {
  // Offset bases, phases and drifts so no two climb in step — six identical
  // curves would read as a comb rather than as planting.
  const specs = [
    { base: 34, amp: 18, freq: 1.7, phase: 0.0, drift: 14 },
    { base: 104, amp: 13, freq: 2.1, phase: 1.1, drift: -9 },
    { base: 170, amp: 20, freq: 1.5, phase: 2.3, drift: 11 },
    { base: 236, amp: 15, freq: 2.3, phase: 0.6, drift: -13 },
    { base: 302, amp: 19, freq: 1.8, phase: 3.0, drift: 8 },
    { base: 368, amp: 12, freq: 2.0, phase: 1.8, drift: -10 },
  ]

  return specs.map((spec, vi) => {
    const f = vineAt(spec)
    return { outline: outlineFor(f), leaves: leavesFor(f, vi) }
  })
}

const LATTICE = buildLattice()
const PLANTS = buildPlants()
