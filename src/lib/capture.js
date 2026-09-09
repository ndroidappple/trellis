import { addDays, startOfDay, toDateInputValue } from './week'

/**
 * Typing a task and meaning it.
 *
 * "Fast capture" is the first thing Tier 1 of the household-OS backlog asks
 * for, and the objective it states is that creating a task should be nearly
 * frictionless. The version this replaces had one text field that produced a
 * weekly chore with no day, no date and no priority — so every capture was
 * followed by opening a sheet and setting the three things you already knew
 * when you typed it.
 *
 * So: type "bins out every tuesday !!" and get a Tuesday chore at high
 * priority. Type "call the plumber tomorrow" and get a one-off due tomorrow.
 *
 * ── Two rules keep this from being annoying ──
 *
 * **Everything is matched at the end of the string, never in the middle.**
 * "Buy tickets for Monday's show" must stay a task called "Buy tickets for
 * Monday's show", not a task called "Buy tickets for" due next Monday. Every
 * task app that matches dates anywhere in the text eventually eats a word
 * somebody meant, and on a shared wall the person who typed it is not the
 * person who finds it broken. End-anchoring costs the phrasing nobody uses
 * ("tomorrow call the plumber") and saves the one everybody does.
 *
 * **Nothing is silently applied.** `parseCapture` returns what it matched so
 * the input can show it back — "Tuesdays · High" under the field — before the
 * row is written. A parser you cannot see is a parser you stop trusting the
 * first time it is wrong.
 */

const WEEKDAYS = [
  ['sunday', 'sun'],
  ['monday', 'mon'],
  ['tuesday', 'tue', 'tues'],
  ['wednesday', 'wed', 'weds'],
  ['thursday', 'thu', 'thurs', 'thur'],
  ['friday', 'fri'],
  ['saturday', 'sat'],
]

const MONTHS = [
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sep', 'sept'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
]

const weekdayAlternatives = WEEKDAYS.flat().join('|')
const monthAlternatives = MONTHS.flat().join('|')

function weekdayIndex(word) {
  return WEEKDAYS.findIndex((names) => names.includes(word))
}

function monthIndex(word) {
  return MONTHS.findIndex((names) => names.includes(word))
}

/**
 * The next date falling on `day`, counting today.
 *
 * "friday" said on a Friday means today. Someone typing the name of the day
 * they are standing in means the day they are standing in; making them wait a
 * week for it would be a strange reading of a very ordinary sentence.
 */
function comingWeekday(today, day) {
  const start = startOfDay(today)
  return addDays(start, (day - start.getDay() + 7) % 7)
}

/**
 * "next friday" — the Friday *after* the coming one.
 *
 * English genuinely disagrees about this phrase, so the tie-break is
 * structural rather than linguistic: this parser already understands bare
 * "friday" as the coming Friday, so if "next friday" resolved to the same
 * date the word "next" would do nothing at all. A modifier that changes
 * nothing is worse than either reading of it.
 */
function followingWeekday(today, day) {
  return addDays(comingWeekday(today, day), 7)
}

/**
 * Each rule gets the trailing text and either claims a chunk of it or doesn't.
 * Order is load-bearing: "every tuesday" has to be tested before the bare
 * weekday rule, or it becomes a one-off on Tuesday and the recurrence is lost.
 */
const RULES = [
  // ---- priority: trailing bangs, more meaning more urgent ----
  {
    pattern: /\s(!{1,3})$/,
    apply: (m) => ({
      patch: { priority: m[1].length },
      label: ['Low', 'Medium', 'High'][m[1].length - 1],
    }),
  },
  {
    pattern: /\s(urgent|high priority)$/i,
    apply: () => ({ patch: { priority: 3 }, label: 'High' }),
  },

  // ---- recurrence ----
  {
    pattern: new RegExp(`\\s(?:every|each)\\s(${weekdayAlternatives})s?$`, 'i'),
    apply: (m, today, capitalise) => {
      const day = weekdayIndex(m[1].toLowerCase())
      return {
        patch: { recurrence: 'weekly', scheduled_day: day, due_on: null },
        label: `${capitalise(WEEKDAYS[day][0])}s`,
      }
    },
  },
  {
    // "every tuesday" is a day; "weekly" on its own is a rhythm with no day,
    // which is a real and different thing — it clears each Sunday.
    pattern: /\s(?:every week|weekly)$/i,
    apply: () => ({
      patch: { recurrence: 'weekly', scheduled_day: null, due_on: null },
      label: 'Any day',
    }),
  },
  {
    pattern: /\s(?:anytime|any time|as needed|whenever|as-needed)$/i,
    apply: () => ({
      patch: { recurrence: 'anytime', scheduled_day: null, due_on: null },
      label: 'As needed',
    }),
  },

  // ---- one-off dates ----
  {
    pattern: /\s(?:today|tonight)$/i,
    apply: (m, today) => ({
      patch: { recurrence: 'once', due_on: toDateInputValue(today), scheduled_day: null },
      label: 'Today',
    }),
  },
  {
    pattern: /\stomorrow$/i,
    apply: (m, today) => ({
      patch: {
        recurrence: 'once',
        due_on: toDateInputValue(addDays(startOfDay(today), 1)),
        scheduled_day: null,
      },
      label: 'Tomorrow',
    }),
  },
  {
    pattern: /\sin (\d{1,3}) (day|days|week|weeks)$/i,
    apply: (m, today) => {
      const n = Number(m[1])
      const days = /^week/i.test(m[2]) ? n * 7 : n
      return {
        patch: {
          recurrence: 'once',
          due_on: toDateInputValue(addDays(startOfDay(today), days)),
          scheduled_day: null,
        },
        label: `In ${n} ${m[2].toLowerCase()}`,
      }
    },
  },
  {
    pattern: new RegExp(`\\snext\\s(${weekdayAlternatives})$`, 'i'),
    apply: (m, today, capitalise) => {
      const day = weekdayIndex(m[1].toLowerCase())
      const date = followingWeekday(today, day)
      return {
        patch: { recurrence: 'once', due_on: toDateInputValue(date), scheduled_day: null },
        label: `Next ${capitalise(WEEKDAYS[day][0])}`,
      }
    },
  },
  {
    pattern: new RegExp(`\\s(?:on\\s)?(${weekdayAlternatives})$`, 'i'),
    apply: (m, today, capitalise) => {
      const day = weekdayIndex(m[1].toLowerCase())
      const date = comingWeekday(today, day)
      return {
        patch: { recurrence: 'once', due_on: toDateInputValue(date), scheduled_day: null },
        label: capitalise(WEEKDAYS[day][0]),
      }
    },
  },
  {
    // "12 sep" and "sep 12" both, because both get typed. No slash dates:
    // 12/9 is September in one hemisphere and December in another, and this
    // app already renders dates through the device locale, so guessing wrong
    // would be invisible until something happened on the wrong day.
    pattern: new RegExp(`\\s(?:on\\s)?(\\d{1,2})\\s(${monthAlternatives})$`, 'i'),
    apply: (m, today) => dateOn(Number(m[1]), monthIndex(m[2].toLowerCase()), today),
  },
  {
    pattern: new RegExp(`\\s(?:on\\s)?(${monthAlternatives})\\s(\\d{1,2})$`, 'i'),
    apply: (m, today) => dateOn(Number(m[2]), monthIndex(m[1].toLowerCase()), today),
  },
]

/**
 * A day and month with no year, resolved forward. "on 3 jan" typed in
 * December means the January three weeks away, not the one eleven months
 * behind — a due date in the past is never what someone meant to type.
 */
function dateOn(dayOfMonth, month, today) {
  const start = startOfDay(today)
  let date = new Date(start.getFullYear(), month, dayOfMonth)
  if (date < start) date = new Date(start.getFullYear() + 1, month, dayOfMonth)

  // Rolls a bad day-of-month into the next month rather than producing
  // "Invalid Date" — 31 Feb becomes 3 March, which is at least a date the
  // person can see is wrong.
  if (date.getMonth() !== month && date.getDate() !== dayOfMonth) return null

  return {
    patch: { recurrence: 'once', due_on: toDateInputValue(date), scheduled_day: null },
    label: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  }
}

const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1)

/**
 * Pull scheduling and priority off the end of typed text.
 *
 * Returns the remaining title, the column patch to write, and the labels for
 * what was understood — in the order a person reads them (when, then how
 * urgent), not the order they were parsed off the end.
 *
 * A string that is *only* modifiers ("tomorrow") leaves no title, so nothing
 * is claimed and the whole thing stays the title. Naming a task "tomorrow" is
 * unusual but it is not the parser's business to refuse it.
 */
export function parseCapture(text, today = new Date()) {
  let title = String(text ?? '').trim()
  const patch = {}
  const labels = []

  let matchedSomething = true
  while (matchedSomething && title.length > 0) {
    matchedSomething = false

    for (const rule of RULES) {
      const match = title.match(rule.pattern)
      if (!match) continue

      const result = rule.apply(match, today, capitalise)
      if (!result) continue

      const remaining = title.slice(0, match.index).trim()
      // Refuse to consume the last word standing. "Tomorrow" on its own is a
      // task called Tomorrow.
      if (remaining.length === 0) continue

      // First rule to claim a field wins, so "friday !! monday" keeps friday
      // rather than quietly overwriting it with whatever came last.
      for (const [key, value] of Object.entries(result.patch)) {
        if (!(key in patch)) patch[key] = value
      }
      labels.unshift(result.label)

      title = remaining
      matchedSomething = true
      break
    }
  }

  return { title, patch, labels: labels.filter(Boolean) }
}

/**
 * What the capture field shows back: "Tuesdays · High".
 *
 * Empty when nothing was understood, so the hint appears only when it has
 * something to say rather than sitting under the field as permanent furniture.
 */
export function captureHint(parsed) {
  return parsed.labels.join(' · ')
}

/** "!!" for medium, "!!!" for high — nothing at all for normal. */
export function priorityLabel(priority) {
  const n = Number(priority ?? 0)
  return n > 0 ? '!'.repeat(n) : null
}
