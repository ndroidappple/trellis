/**
 * Feature #18 — Home. Mock data and pure logic for the Home room.
 *
 * Every device and scene here is invented — there is no real smart-home
 * integration behind it yet (see the "Future work" section of Feature #18
 * in docs/feature-backlog.md and the doc comment atop HomeSheet.jsx). This
 * module exists anyway, separate from the component, for the same reason
 * lib/meals.js and lib/chores.js are separate from Wall.jsx: grouping,
 * scene application and "what counts as on" are logic Wall's tests (if this
 * app ever gets a test runner — see CLAUDE.md's open items) would want to
 * reach without mounting a component, and it's the seam a real backend
 * would slot in behind later without HomeSheet.jsx needing to change shape.
 */

export const ROOMS = ['Kitchen', 'Living Room', 'Bedroom', 'Entry']

/**
 * Placeholder devices, standing in for whatever Nick and Ed's actual rooms
 * hold. Swap this array for real ones (and eventually a real fetch) — the
 * shape (id, name, room, icon, dimmable, on, bright) is what HomeSheet reads,
 * so real data only needs to arrive in this shape, not force a rewrite.
 */
export const INITIAL_DEVICES = [
  { id: 'k1', name: 'Counter Lights', room: 'Kitchen', icon: 'strip', dimmable: true, on: true, bright: 80 },
  { id: 'k2', name: 'Pendants', room: 'Kitchen', icon: 'ceiling', dimmable: true, on: true, bright: 45 },
  { id: 'k3', name: 'Coffee Maker', room: 'Kitchen', icon: 'plug', dimmable: false, on: false, bright: 100 },
  { id: 'l1', name: 'Floor Lamp', room: 'Living Room', icon: 'lamp', dimmable: true, on: true, bright: 60 },
  { id: 'l2', name: 'TV Backlight', room: 'Living Room', icon: 'strip', dimmable: true, on: false, bright: 35 },
  { id: 'l3', name: 'Sonos Arc', room: 'Living Room', icon: 'speaker', dimmable: false, on: false, bright: 100 },
  { id: 'b1', name: 'Bedside Lamp', room: 'Bedroom', icon: 'lamp', dimmable: true, on: false, bright: 25 },
  { id: 'b2', name: 'Ceiling Fan', room: 'Bedroom', icon: 'fan', dimmable: false, on: true, bright: 100 },
  { id: 'b3', name: 'Closet Light', room: 'Bedroom', icon: 'ceiling', dimmable: true, on: false, bright: 100 },
  { id: 'e1', name: 'Entry Light', room: 'Entry', icon: 'ceiling', dimmable: true, on: true, bright: 100 },
  { id: 'e2', name: 'Salt Lamp', room: 'Entry', icon: 'plug', dimmable: false, on: false, bright: 100 },
]

/**
 * A scene is a room-by-room rule, not a fixed list of settings — "Good
 * Morning" means something different in a household with three rooms than
 * one with five. `apply` takes one device and returns the next version of
 * it, so running a scene is just `devices.map(scene.apply)`.
 */
export const SCENES = [
  {
    id: 'good-morning',
    name: 'Good Morning',
    icon: 'sun',
    apply: (d) => (d.room === 'Kitchen' ? { ...d, on: true, bright: 100 } : { ...d, on: false }),
  },
  {
    id: 'dinner',
    name: 'Dinner',
    icon: 'pot',
    apply: (d) => (d.room === 'Kitchen' ? { ...d, on: true, bright: 70 } : { ...d, on: false }),
  },
  {
    id: 'movie-night',
    name: 'Movie Night',
    icon: 'film',
    apply: (d) => (d.id === 'l2' ? { ...d, on: true, bright: 30 } : { ...d, on: false }),
  },
  {
    id: 'good-night',
    name: 'Good Night',
    icon: 'moon',
    apply: (d) => (d.id === 'b1' ? { ...d, on: true, bright: 15 } : { ...d, on: false }),
  },
]

export function applyScene(devices, scene) {
  return devices.map(scene.apply)
}

/** Room name -> that room's devices, in ROOMS order, empty rooms dropped. */
export function groupByRoom(devices) {
  return ROOMS.map((room) => [room, devices.filter((d) => d.room === room)]).filter(
    ([, list]) => list.length > 0
  )
}

/** "3 lights on", used by the room's subtitle — a status, not a label. */
export function summaryFor(devices) {
  const on = devices.filter((d) => d.on).length
  if (on === 0) return 'Everything off'
  return `${on} of ${devices.length} on`
}
