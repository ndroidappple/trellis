import { addDays, toDateInputValue } from './week'

/**
 * Chore scheduling and completion, kept pure so it can be reasoned about
 * without a database.
 *
 * The shape comes from migration 009: a chore is a *template*, and
 * chore_completions is a log of occurrences. Which occurrence a tick belongs
 * to is decided here, and the rule has to match the one written into 009's
 * backfill exactly — if these two ever disagree, ticks silently vanish.
 */

/** Sunday-indexed, matching startOfWeek() and Date.getDay(). */
export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Which date a chore's tick belongs to, for the week being viewed.
 *
 *   weekly + a weekday  -> that weekday of this week
 *   weekly, unscheduled -> the week itself, keyed by its Sunday
 *   once + a due date   -> that date, whatever week it falls in
 *   once, unscheduled   -> null; it has no occurrence, it is just done or not
 *
 * Returning the week start for an unscheduled weekly chore is what preserves
 * the old behaviour: one tick per week, clearing itself each Sunday, with no
 * scheduled job needed to reset anything.
 */
export function choreOccurrenceDate(chore, weekStart) {
  if (chore.recurrence === 'once') {
    return chore.due_on ?? null
  }

  const offset = chore.scheduled_day == null ? 0 : Number(chore.scheduled_day)
  return toDateInputValue(addDays(weekStart, offset))
}

/** True when this chore is scheduled onto a particular day at all. */
export function isScheduled(chore) {
  return chore.recurrence === 'once' ? chore.due_on != null : chore.scheduled_day != null
}

/**
 * The label the panel shows beside a chore.
 *
 * "Tuesdays" reads as recurring and "Tue 10 Sep" reads as a single date,
 * which is the whole distinction between the two kinds of scheduling — so
 * the plural is load-bearing rather than decorative.
 */
export function choreScheduleLabel(chore) {
  if (chore.recurrence === 'once') {
    if (!chore.due_on) return 'One-off'
    const d = new Date(`${chore.due_on}T00:00`)
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`
  }

  if (chore.scheduled_day == null) return 'Any day'
  return `${WEEKDAY_NAMES[Number(chore.scheduled_day)]}s`
}

/**
 * What a drop on a given day means for this chore.
 *
 * A weekly chore dropped on Tuesday recurs every Tuesday; a one-off dropped
 * on Tuesday happens on that Tuesday only. 009 constrains each kind to its
 * own column, so exactly one of these is ever set.
 */
export function schedulePatchFor(chore, dateIso) {
  if (chore.recurrence === 'once') {
    return { due_on: dateIso, scheduled_day: null }
  }
  const day = dateIso ? new Date(`${dateIso}T00:00`).getDay() : null
  return { scheduled_day: day, due_on: null }
}

/** Back to the backlog: no weekday, no date, still the same chore. */
export function unschedulePatch(chore) {
  return chore.recurrence === 'once'
    ? { due_on: null, scheduled_day: null }
    : { scheduled_day: null, due_on: null }
}
