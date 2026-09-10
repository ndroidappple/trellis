/**
 * Settings for the ambient screen timeout, and the two bits of arithmetic it
 * needs. Kept out of the component so they can be reasoned about — and one
 * day tested — without mounting a full-screen animation.
 */

/**
 * The choices, in minutes. `never` is a first-class option rather than a
 * disabled toggle elsewhere: "off" and "after 30 minutes" are the same
 * question asked once, and splitting them into a switch plus a duration
 * produces the state where the switch says on and the duration says never.
 */
export const TIMEOUT_OPTIONS = [
  { value: 2, label: '2 min' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
  { value: 'never', label: 'Never' },
]

/** Ten minutes, per the spec. Long enough not to interrupt a conversation
 *  happening in front of the board. */
export const DEFAULT_TIMEOUT_MIN = 10

const DEVICE_KEY = 'trellis.screensaver.timeout'

/**
 * Timeout is the one board setting that is wrong at household scope.
 *
 * Every other setting here describes the board itself, so the wall and a phone
 * agreeing is the point. This one describes a *device*: the wall wants to fade
 * out after ten minutes because it hangs in a room, and a phone almost
 * certainly never wants to do this at all, because a phone already has an idle
 * behaviour of its own and it is called locking. Forcing both to one number
 * means whichever surface loses the argument is wrong all the time.
 *
 * So: the household row carries a default, and any device may pin its own,
 * held in localStorage — which is per-origin and per-installed-app, and is
 * therefore already exactly the "which device am I" that Trellis otherwise
 * has no notion of.
 *
 * `null` means "no opinion, follow the household", which is distinct from
 * `'never'` — a device that has chosen never must not silently start fading
 * again because someone changed the household default from a phone.
 */
export function readDeviceTimeout() {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    if (raw == null) return null
    if (raw === 'never') return 'never'

    const n = Number(raw)
    return TIMEOUT_OPTIONS.some((o) => o.value === n) ? n : null
  } catch {
    return null
  }
}

export function writeDeviceTimeout(value) {
  try {
    if (value == null) localStorage.removeItem(DEVICE_KEY)
    else localStorage.setItem(DEVICE_KEY, String(value))
  } catch {
    /* Private mode. The household default still applies, which is the
       reasonable fallback for a device that cannot remember anything. */
  }
}

/**
 * The number actually in force, in milliseconds — or null for "never fade",
 * which is also what an unrecognised value degrades to. Anything the board
 * cannot make sense of should leave the screen alone rather than guess at a
 * duration and start hiding the week.
 */
export function timeoutMsFor(householdMin, deviceMin) {
  const chosen = deviceMin ?? householdMin ?? DEFAULT_TIMEOUT_MIN
  if (chosen === 'never') return null

  const n = Number(chosen)
  return Number.isFinite(n) && n > 0 ? n * 60 * 1000 : null
}

/**
 * Night runs 22:00–06:00 and is not configurable yet, deliberately.
 *
 * The spec lists the hour as optional, and a wall-mounted iPad does not need a
 * fourth chip row to settle a question that has one obvious answer in a house
 * where people sleep. It reads the hour off the clock passed in rather than
 * calling `new Date()` itself, for the same reason nothing else here does: the
 * caller owns the clock, so DST and a suspended iPad are handled in one place.
 */
export const NIGHT_FROM_HOUR = 22
export const NIGHT_TO_HOUR = 6

export function isNightAt(date) {
  const h = date.getHours()
  return h >= NIGHT_FROM_HOUR || h < NIGHT_TO_HOUR
}
