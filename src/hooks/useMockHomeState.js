import { useState } from 'react'
import { INITIAL_DEVICES, applyScene } from '../lib/home'

/**
 * Feature #18's mock device state, lifted out of HomeSheet.jsx so the full
 * Home room and the board's HomeWidget read and write the same devices
 * within a session — see the widget-home-screen plan's Phase 2 notes.
 * Without this, toggling a light on the widget and then opening the full
 * room would show it reset back to INITIAL_DEVICES, a more visible version
 * of the shell's already-known "no persistence" gap. Still 100% local
 * useState, zero backend — just lifted one level so the two views of the
 * same fake data can't disagree.
 */

const TOGGLE_DELAY_MS = 260

export function useMockHomeState() {
  const [devices, setDevices] = useState(INITIAL_DEVICES)

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

  return { devices, toggle, setBrightness, runScene }
}
