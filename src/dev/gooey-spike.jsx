import { useEffect, useRef, useState } from 'react'
import { Liquid } from 'liquid-gooey'

/**
 * Phase 0 throwaway spike (see the widget-home-screen plan). NOT meant to
 * ship — no route links here, it only renders when `?gooey-spike` is in the
 * URL (see main.jsx). Exercises the three liquid-gooey moments the plan
 * proposes for Phase 4 (drag/move, resize/bend, tap/morph) so a go/no-go
 * call can be made on REAL hardware, not this dev server.
 *
 * What this file can and can't tell you:
 *  - CAN show: does it render at all on this device's Safari, does dragging
 *    feel physically plausible, does the on-screen FPS readout stay near the
 *    display's refresh rate during interaction.
 *  - CAN'T show: multi-hour memory growth (soak-test separately), whether
 *    idle cost is truly zero (the on-screen counter below only samples
 *    while this tab is focused and only while something is animating).
 *  - `performance.memory` is Chrome-only and absent in Safari — the memory
 *    readout will say "unavailable" there, which is expected, not a bug.
 */

function useFps() {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    let raf
    let frames = 0
    let last = performance.now()
    function tick(now) {
      frames++
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return fps
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function MemoryReadout() {
  const [mem, setMem] = useState(null)
  useEffect(() => {
    if (!performance.memory) return
    const id = setInterval(() => {
      setMem(Math.round(performance.memory.usedJSHeapSize / 1048576))
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return <span>{mem == null ? 'heap: unavailable (not Chrome)' : `heap: ${mem} MB`}</span>
}

/** Mimics a widget tile being dragged across the board — effect="move". */
function DragMoveDemo({ reducedMotion }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dropZoneRef = useRef(null)
  const origin = useRef({ x: 0, y: 0 })

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    setDragging(true)
  }
  function onPointerMove(e) {
    if (!dragging) return
    setPos({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y })
  }
  function onPointerUp(e) {
    setDragging(false)
    const zone = dropZoneRef.current?.getBoundingClientRect()
    const valid = zone && e.clientX >= zone.left && e.clientX <= zone.right && e.clientY >= zone.top && e.clientY <= zone.bottom
    if (!valid) setPos({ x: 0, y: 0 }) // reject-and-snap-back, per the Phase 1 plan
  }

  return (
    <section className="spike-section">
      <h2>1 — Drag-lift / snap-back (effect="move")</h2>
      <p>Drag the tile into the dashed zone. Drop outside it and it springs back.</p>
      <div className="spike-stage">
        <div ref={dropZoneRef} className="spike-dropzone">valid drop zone</div>
        <Liquid blur={8} contrast={20} fill="var(--slat-face)" shadow="0 4px 14px rgba(0,0,0,.18)">
          <Liquid.Item
            effect={reducedMotion ? undefined : 'move'}
            x={pos.x}
            y={pos.y}
            transition={dragging ? { duration: 0 } : 'bouncy'}
            move={{ springiness: 0.5, trail: 0.5 }}
          >
            <div
              className="spike-tile"
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              Drag me
            </div>
          </Liquid.Item>
        </Liquid>
      </div>
    </section>
  )
}

/** Mimics a resize handle deforming the tile under velocity — effect="bend". */
function ResizeBendDemo({ reducedMotion }) {
  const [dims, setDims] = useState({ w: 160, h: 120 })
  const [active, setActive] = useState(false)
  const start = useRef(null)

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, w: dims.w, h: dims.h }
    setActive(true)
  }
  function onPointerMove(e) {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    setDims({
      w: Math.max(100, start.current.w + dx),
      h: Math.max(80, start.current.h + dy),
    })
  }
  function onPointerUp() {
    start.current = null
    setActive(false)
  }

  return (
    <section className="spike-section">
      <h2>2 — Resize handle (effect="bend")</h2>
      <p>Drag the corner grip. The body should visibly give under velocity.</p>
      <div className="spike-stage">
        <Liquid blur={6} contrast={18} fill="var(--slat-face)" shadow="0 4px 14px rgba(0,0,0,.18)">
          <Liquid.Item
            effect={reducedMotion ? undefined : 'bend'}
            bend={{ vertical: 0.6, horizontal: 0.35 }}
          >
            <div className="spike-tile" style={{ width: dims.w, height: dims.h }}>
              Resize me
              <div
                className="spike-grip"
                style={{ touchAction: 'none' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            </div>
          </Liquid.Item>
        </Liquid>
        <p className="spike-meta">{active ? 'resizing…' : `${Math.round(dims.w)} × ${Math.round(dims.h)}`}</p>
      </div>
    </section>
  )
}

/** Mimics a widget tile expanding into a full-room sheet — morph shape. */
function MorphOpenDemo({ reducedMotion }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="spike-section">
      <h2>3 — Tile → room morph (morph shape)</h2>
      <p>Tap the tile. This is the highest-risk Phase 4 candidate — judge whether the shape-change reads as "grew into a room" or just "resized."</p>
      <div className="spike-stage" style={{ minHeight: 260 }}>
        <Liquid blur={10} contrast={22} fill="var(--slat-face)" shadow="0 8px 24px rgba(0,0,0,.22)">
          <Liquid.Item
            effect="morph"
            morph={reducedMotion ? { shape: false } : { shape: true, bounce: 0.4 }}
          >
            <button
              type="button"
              className="spike-tile spike-tile--morph"
              data-open={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Tap to close (full room)' : 'Tap to open (widget tile)'}
            </button>
          </Liquid.Item>
        </Liquid>
      </div>
    </section>
  )
}

export default function GooeySpike() {
  const fps = useFps()
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div className="spike-root">
      <style>{`
        .spike-root { font-family: var(--font-text, system-ui); padding: 24px; max-width: 720px; margin: 0 auto; color: var(--ink, #1a1a12); background: var(--plaster, #ece9df); min-height: 100vh; }
        .spike-hud { position: sticky; top: 0; background: var(--plaster, #ece9df); padding: 8px 0 16px; font-size: 13px; display: flex; gap: 16px; border-bottom: 1px solid var(--rule, #ccc); margin-bottom: 16px; }
        .spike-section { margin-bottom: 40px; }
        .spike-section h2 { font-size: 16px; margin-bottom: 4px; }
        .spike-section p { font-size: 13px; color: var(--ink-soft, #555); margin: 0 0 12px; }
        .spike-stage { position: relative; min-height: 160px; }
        .spike-dropzone { position: absolute; right: 0; top: 0; width: 140px; height: 100px; border: 2px dashed var(--ink-faint, #999); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--ink-faint, #999); }
        .spike-tile { width: 140px; height: 100px; display: flex; align-items: center; justify-content: center; font-size: 13px; cursor: grab; border-radius: 16px; user-select: none; position: relative; }
        .spike-tile--morph { width: 220px; height: 90px; border: none; font: inherit; }
        .spike-tile--morph[data-open='true'] { width: 420px; height: 220px; }
        .spike-grip { position: absolute; right: -6px; bottom: -6px; width: 28px; height: 28px; border-radius: 50%; background: var(--lit, #c9a227); cursor: nwse-resize; }
        .spike-meta { font-size: 12px; color: var(--ink-faint, #999); margin-top: 8px; }
        .spike-note { font-size: 12px; color: var(--ink-faint, #999); margin-top: -8px; margin-bottom: 24px; }
      `}</style>
      <div className="spike-hud">
        <span>FPS: {fps}</span>
        <MemoryReadout />
        <span>reduced-motion: {reducedMotion ? 'ON (effects disabled below)' : 'off'}</span>
      </div>
      <p className="spike-note">
        Phase 0 spike — not shipped UI. Load this on the actual 11" iPad's
        Safari, not this dev server, before treating any of it as a verdict.
      </p>
      <DragMoveDemo reducedMotion={reducedMotion} />
      <ResizeBendDemo reducedMotion={reducedMotion} />
      <MorphOpenDemo reducedMotion={reducedMotion} />
    </div>
  )
}
