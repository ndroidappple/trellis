import { daysInYear, daysLeftInYear, dayOfYear, fiscalWeek, yearProgress } from './year'

/**
 * Optional asides for the header's second line — the board having a bit of
 * character rather than telling you anything you need. Deliberately not
 * advertised: someone poking at the board finds them, someone reading the
 * week never notices they exist.
 *
 * Several can be on at once. Each therefore carries two renderings: alone it
 * can afford to spell itself out, but shown alongside others it shortens,
 * because the header shares a row with the sync state and the week arrows
 * and cannot grow sideways forever.
 *
 * 'off' is no longer an entry — an empty selection is off, which is what
 * unticking the last chip naturally produces.
 */
export const FLOURISHES = [
  {
    id: 'week',
    label: 'Week',
    render: (d) => `Week ${fiscalWeek(d)}`,
    short: (d) => `Week ${fiscalWeek(d)}`,
  },
  {
    id: 'progress',
    label: 'Year %',
    render: (d) => `${yearProgress(d)}% through ${d.getFullYear()}`,
    short: (d) => `${yearProgress(d)}%`,
  },
  {
    id: 'daysLeft',
    label: 'Days left',
    render: (d) => {
      const n = daysLeftInYear(d)
      return n === 0 ? 'Last day of the year' : `${n} days left in ${d.getFullYear()}`
    },
    short: (d) => {
      const n = daysLeftInYear(d)
      return n === 0 ? 'Last day' : `${n} left`
    },
  },
  {
    id: 'dayOfYear',
    label: 'Day no.',
    render: (d) => `Day ${dayOfYear(d)} of ${daysInYear(d.getFullYear())}`,
    short: (d) => `Day ${dayOfYear(d)}`,
  },
]

/**
 * How many asides fit depends on how wide the header actually is, which now
 * varies by orientation on the 11" iPad rather than being one fixed number:
 * portrait (834pt) is narrower than the 1024pt this was originally measured
 * against, landscape (1194pt) is wider. `maxFlourishesFor` below is the
 * orientation-aware version of what used to be a single constant.
 *
 * The header wraps rather than clips if either guess is wrong (see
 * .board__sub), so the failure mode is a slightly taller header, not the
 * silent amputation this layout is prone to.
 */
export function maxFlourishesFor(orientation) {
  return orientation === 'landscape' ? 3 : 2
}

/**
 * Reads whatever is in board_settings as a list of valid ids.
 *
 * Households already have a bare string stored here from when this was a
 * single choice, so that has to keep working — a wall that dropped its
 * header aside on upgrade would be a puzzling little regression. Unknown
 * ids are dropped rather than rendered as blanks.
 */
export function toFlourishIds(value, max = maxFlourishesFor('portrait')) {
  const known = (id) => FLOURISHES.some((f) => f.id === id)
  const chosen = Array.isArray(value) ? value : value == null || value === 'off' ? [] : [value]
  // Canonical order, not tap order: the header should not reshuffle itself
  // because of the sequence someone happened to tick the chips in.
  return FLOURISHES.filter((f) => chosen.includes(f.id) && known(f.id))
    .map((f) => f.id)
    .slice(0, max)
}
