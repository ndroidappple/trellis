import { useEffect, useMemo, useRef, useState } from 'react'
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
 *
 * **`collapsible` folds it down to a single button until it is wanted.**
 *
 * The field used to sit open permanently at the foot of both dock panels. That
 * placement is still right and has not changed — it is *outside* the scrolling
 * list, so capture never means scrolling to the bottom of a full panel — but
 * standing open it is a text input in a panel otherwise made of rows, drawing
 * a hard rectangle across the base of a surface whose whole design is paper
 * and hairlines. Dead space that competes with the content it sits under.
 *
 * The cost is one tap before typing, and it is worth naming because capture
 * speed was the reason the row was placed where it is. Two things pay it back:
 * the button is the same target the field's own "Add" was, and the field stays
 * open after a submit — shopping in particular is rarely one item — so the tap
 * is once per session at the panel, not once per item.
 *
 * The full pages pass `collapsible={false}`. A page has the room, nothing is
 * competing for it, and going to a page to add something is already a
 * statement of intent.
 */
export default function AddRow({
  placeholder,
  onAdd,
  parse = false,
  today,
  collapsible = false,
  openLabel = 'Add',
}) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(!collapsible)
  const inputRef = useRef(null)

  const parsed = useMemo(
    () => (parse ? parseCapture(value, today ?? new Date()) : null),
    [parse, value, today]
  )

  const hint = parsed ? captureHint(parsed) : ''

  // Focus only when opened by hand. Autofocusing a permanently-open field
  // would summon the keyboard over half the board on every load, which is the
  // same reason the recipe search and the meal picker do not autofocus.
  useEffect(() => {
    if (open && collapsible) inputRef.current?.focus()
  }, [open, collapsible])

  function submit() {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
    // Deliberately stays open. A shopping trip is a list, not an item.
    inputRef.current?.focus()
  }

  function close() {
    setValue('')
    setOpen(false)
  }

  if (collapsible && !open) {
    return (
      <div className="panel-add panel-add--closed">
        <button className="panel-add__open" onClick={() => setOpen(true)}>
          <span className="panel-add__plus" aria-hidden="true">+</span>
          {openLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="panel-add">
      <div className="panel-add__field">
        <input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            // Escape is the keyboard's own way out; the ✕ is the wall's.
            if (e.key === 'Escape' && collapsible) close()
          }}
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
      {/* Only where there is something to collapse back to. Without it the
          field opens and never closes, and the space it was taking is simply
          taken again for the rest of the day. */}
      {collapsible && (
        <button className="ghost panel-add__close" onClick={close} aria-label="Done adding">
          ✕
        </button>
      )}
    </div>
  )
}
