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
export function choreOccurrenceDate(chore, weekStart, today) {
  // An anytime chore has no occurrence in a week at all — it is done on the
  // day it is done. Keying it to today is what turns four dishwasher runs
  // into four rows instead of one, and it is why an anytime chore's row
  // shows a log rather than a checkbox: there is nothing to be "done" with.
  if (chore.recurrence === 'anytime') {
    return today ? toDateInputValue(today) : null
  }

  if (chore.recurrence === 'once') {
    return chore.due_on ?? null
  }

  const offset = chore.scheduled_day == null ? 0 : Number(chore.scheduled_day)
  return toDateInputValue(addDays(weekStart, offset))
}

/**
 * True for chores that repeat on no schedule and are never "done" — only
 * more or less recently done. The panel renders these completely differently,
 * so this is the one predicate worth naming.
 */
export function isEpisodic(chore) {
  return chore.recurrence === 'anytime'
}

/** True when this chore is scheduled onto a particular day at all. */
export function isScheduled(chore) {
  if (chore.recurrence === 'anytime') return false
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
  if (chore.recurrence === 'anytime') return 'As needed'

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
  // Null means "this cannot be scheduled" — the constraint in 012 would
  // reject it anyway, and a rejected drop that looked like it worked until
  // the next refetch is worse than a drop that visibly does nothing.
  if (chore.recurrence === 'anytime') return null

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

/**
 * Whose turn it is, for a chore that alternates.
 *
 * Derived, never stored. Whoever did it last is not up next; everyone else
 * is, and in a two-person household "everyone else" is one person. Storing a
 * `next_person_id` column instead would create a second source of truth that
 * drifts from the log the first time someone ticks out of order or a
 * completion is deleted.
 *
 * Returns null when there is nothing to say — the chore does not rotate, the
 * household is one person, or nobody has ever done it so no turn has been
 * established. Null means the UI says nothing rather than inventing a claim
 * about whose job this is.
 */
export function nextTurn(chore, last, people) {
  if (!chore.rotates) return null
  if (!Array.isArray(people) || people.length < 2) return null

  const lastPersonId = last?.completed_by ?? null
  if (!lastPersonId) return null

  const others = people.filter((p) => p.id !== lastPersonId)
  // Everyone did it last, somehow, or the last person is no longer in the
  // household. Either way there is no meaningful "next".
  return others.length === 1 ? others[0] : null
}

/**
 * "today" / "yesterday" / "3 days ago", for the last time a chore was done.
 *
 * Relative rather than a date, because the question being asked at the sink
 * is "has this been done recently", and "Tuesday" forces you to work out what
 * day it is first. Anything beyond a fortnight gets the date back, where the
 * exact day stops mattering and the distance starts to.
 *
 * Takes today as an argument rather than calling new Date(): this runs during
 * render, and the wall has to re-render at midnight rather than drift.
 */
export function agoLabel(dateIso, today) {
  if (!dateIso || !today) return null

  const then = new Date(`${dateIso}T00:00`)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((now - then) / 86400000)

  if (days < 0) return null
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days <= 14) return `${days} days ago`

  return `${WEEKDAY_SHORT[then.getDay()]} ${then.getDate()} ${then.toLocaleDateString(undefined, { month: 'short' })}`
}
