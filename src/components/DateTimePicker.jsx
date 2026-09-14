import { useState } from 'react'
import { addDays, dayName, isSameDay, timeLabel, toDateInputValue, toInputValue } from '../lib/week'
import './DateTimePicker.css'

/**
 * Replaces the native `<input type="datetime-local">` in the event editor.
 *
 * That control was the one thing in the dialog that didn't belong to this
 * design system — system font, a browser-default calendar icon, no way to
 * restyle the picker popup at all — sitting inside an otherwise fully
 * bespoke app. This is a custom control instead, built on the same date
 * math `lib/week.js` already has (no date library here either, same reason
 * as there: the job is small).
 *
 * It reads and writes the exact same string format the native input did
 * (`toInputValue`/`toDateInputValue`'s output), so `EventEditor`'s `when`
 * state and its save() logic don't need to change shape at all — this is a
 * drop-in replacement for the field, not a new data model.
 *
 * Quick-day chips cover the common case (this week); a native `<input
 * type="date">` is the deliberate fallback for anything further out, styled
 * down to a plain text link rather than a full field, since it's the escape
 * hatch and not the primary interaction. Time is hour/minute steppers plus
 * an AM/PM toggle, matching Home's dimmer in spirit — a small custom control
 * rather than reaching for a native input a second time.
 */
const QUICK_DAYS = 7

function relativeDayLabel(date, today) {
  if (isSameDay(date, today)) return 'Today'
  if (isSameDay(date, addDays(today, 1))) return 'Tomorrow'
  return dayName(date)
}

function formatTrigger(date, allDay) {
  const today = new Date()
  const isNear = Math.abs(date - today) < 6 * 24 * 60 * 60 * 1000
  const dayText = isNear
    ? relativeDayLabel(date, today)
    : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return allDay ? dayText : `${dayText} · ${timeLabel(date)}`
}

export default function DateTimePicker({ value, allDay, onChange }) {
  const [open, setOpen] = useState(false)
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00`)
  const today = new Date()

  function commitDate(nextDate) {
    const merged = new Date(nextDate)
    if (!allDay) merged.setHours(date.getHours(), date.getMinutes(), 0, 0)
    onChange(allDay ? toDateInputValue(merged) : toInputValue(merged))
  }

  function commitTime(hours, minutes) {
    const merged = new Date(date)
    merged.setHours(hours, minutes, 0, 0)
    onChange(toInputValue(merged))
  }

  // Explicit modulo arithmetic throughout, rather than letting Date's own
  // hour/minute rollover carry an hour step into the next calendar day —
  // which date is selected is the day chips' job, not the time stepper's.
  function stepHour(delta) {
    const hours = (((date.getHours() + delta) % 24) + 24) % 24
    commitTime(hours, date.getMinutes())
  }

  function stepMinute(delta) {
    let minutes = date.getMinutes() + delta * 15
    let hours = date.getHours()
    if (minutes >= 60) {
      minutes -= 60
      hours = (hours + 1) % 24
    } else if (minutes < 0) {
      minutes += 60
      hours = (hours - 1 + 24) % 24
    }
    commitTime(hours, minutes)
  }

  function toggleAmPm() {
    commitTime((date.getHours() + 12) % 24, date.getMinutes())
  }

  const quickDays = Array.from({ length: QUICK_DAYS }, (_, i) => addDays(today, i))
  const hour12 = ((date.getHours() + 11) % 12) + 1

  return (
    <div className="dtp">
      <button type="button" className="dtp__trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {formatTrigger(date, allDay)}
      </button>

      {open && (
        <div className="dtp__panel">
          <div className="dtp__days">
            {quickDays.map((d) => (
              <button
                key={toDateInputValue(d)}
                type="button"
                className={isSameDay(d, date) ? 'dtp__day is-on' : 'dtp__day'}
                onClick={() => commitDate(d)}
              >
                {relativeDayLabel(d, today)}
              </button>
            ))}
          </div>

          <label className="dtp__more">
            Pick another date
            <input
              type="date"
              value={toDateInputValue(date)}
              onChange={(e) => e.target.value && commitDate(new Date(`${e.target.value}T00:00`))}
            />
          </label>

          {!allDay && (
            <div className="dtp__time">
              <div className="dtp__stepper">
                <button type="button" aria-label="Hour up" onClick={() => stepHour(1)}>▲</button>
                <span>{hour12}</span>
                <button type="button" aria-label="Hour down" onClick={() => stepHour(-1)}>▼</button>
              </div>
              <span className="dtp__colon">:</span>
              <div className="dtp__stepper">
                <button type="button" aria-label="Minute up" onClick={() => stepMinute(1)}>▲</button>
                <span>{String(date.getMinutes()).padStart(2, '0')}</span>
                <button type="button" aria-label="Minute down" onClick={() => stepMinute(-1)}>▼</button>
              </div>
              <button type="button" className="dtp__ampm" onClick={toggleAmPm}>
                {date.getHours() < 12 ? 'AM' : 'PM'}
              </button>
            </div>
          )}

          <button type="button" className="dtp__done" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}
