/**
 * Where we are in the year.
 *
 * Small facts a wall calendar can afford to show and a phone can't be
 * bothered to. None of it is load-bearing — it's the board having a bit of
 * character — so everything here stays cheap and exact.
 *
 * All arithmetic goes through Date.UTC rather than subtracting local Dates:
 * a day is not reliably 86,400,000 ms locally, and on the two DST days a
 * naive subtraction rounds to the wrong day.
 */

function utcDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365
}

/** 1 on 1 January, 365 or 366 on 31 December. */
export function dayOfYear(date) {
  const start = Date.UTC(date.getFullYear(), 0, 1)
  return Math.round((utcDay(date) - start) / 86400000) + 1
}

/**
 * Week of the year, 1–52, counting seven-day blocks from 1 January.
 *
 * Deliberately not ISO 8601. ISO weeks start on Monday, can put early
 * January in week 52 or 53 of the *previous* year, and give some years 53
 * weeks — all correct, all baffling on a kitchen wall. This is the plain
 * reading: week 1 starts on 1 January, and the last week of the year is 52
 * and absorbs the spare day or two rather than opening a stub week 53.
 */
export function fiscalWeek(date) {
  return Math.min(52, Math.floor((dayOfYear(date) - 1) / 7) + 1)
}

/** Whole days remaining after today, so 31 December reads 0. */
export function daysLeftInYear(date) {
  return daysInYear(date.getFullYear()) - dayOfYear(date)
}

/** 0–100, rounded. 31 December is 100. */
export function yearProgress(date) {
  return Math.round((dayOfYear(date) / daysInYear(date.getFullYear())) * 100)
}
