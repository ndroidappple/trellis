import { useMemo, useState } from 'react'
import { captureHint, parseCapture } from '../lib/capture'

/**
 * The capture field.
 *
 * With `parse`, it reads scheduling and priority off the end of what you type
 * and shows back what it understood — "Tuesdays · High" — before anything is
 * written. That readback is the point: a parser you cannot see is a parser
 * you stop trusting the first time it guesses wrong, and the fix for a wrong
 * guess is then to keep typing rather than to open a sheet afterwards.
 *
 * The shopping list passes no `parse`, because "every tuesday" on a shopping
 * list is a thing called every tuesday.
 */
export default function AddRow({ placeholder, onAdd, parse = false, today }) {
  const [value, setValue] = useState('')

  const parsed = useMemo(
    () => (parse ? parseCapture(value, today ?? new Date()) : null),
    [parse, value, today]
  )

  const hint = parsed ? captureHint(parsed) : ''

  function submit() {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }

  return (
    <div className="panel-add">
      <div className="panel-add__field">
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {/* aria-live so the readback is announced as it changes, rather than
            being a purely visual confirmation. */}
        {hint && (
          <span className="panel-add__hint" aria-live="polite">
            {hint}
          </span>
        )}
      </div>
      <button className="ghost" onClick={submit}>
        Add
      </button>
    </div>
  )
}
