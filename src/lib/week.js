// Date helpers for a Monday-start week.
//
// No date library on purpose. This runs on a 2018 iPad and the whole job is a
// few dozen lines. Everything here works in the device's local timezone, which
// is what you want for a wall calendar in one apartment.

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** The Monday on or before the given date. */
export function startOfWeek(date) {
  const d = startOfDay(date)
  const day = d.getDay() // 0 = Sunday
  const shift = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + shift)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(date) {
  return isSameDay(date, new Date())
}

/** The seven Date objects for the week containing `date`. */
export function weekDays(date) {
  const monday = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function dayName(date) {
  const i = date.getDay()
  return DAY_NAMES[i === 0 ? 6 : i - 1]
}

/** "March 3 – 9" or "March 30 – April 5" */
export function weekLabel(date) {
  const monday = startOfWeek(date)
  const sunday = addDays(monday, 6)
  const month = (d) => d.toLocaleDateString(undefined, { month: 'long' })

  return month(monday) === month(sunday)
    ? `${month(monday)} ${monday.getDate()} – ${sunday.getDate()}`
    : `${month(monday)} ${monday.getDate()} – ${month(sunday)} ${sunday.getDate()}`
}

/** "7:30 PM", or "7 PM" when it's on the hour. */
export function timeLabel(date) {
  return date
    .toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: date.getMinutes() === 0 ? undefined : '2-digit',
    })
    .replace(/\s/g, ' ')
}

/** Local time formatted for an <input type="datetime-local">. */
export function toInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Local date formatted for an <input type="date">. */
export function toDateInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
