import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  addDays,
  dayName,
  isToday,
  startOfWeek,
  timeLabel,
  toDateInputValue,
  toInputValue,
  weekDays,
  weekLabel,
} from '../lib/week'

export default function WeekGrid({ profile, people }) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

  const days = weekDays(anchor)

  const load = useCallback(async () => {
    const from = startOfWeek(anchor)
    const to = addDays(from, 7)

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at', { ascending: true })

    if (error) setError(error.message)
    else {
      setEvents(data ?? [])
      setError(null)
    }
  }, [anchor])

  useEffect(() => {
    load()
  }, [load])

  // Realtime. Any change to events anywhere re-reads the visible week. Cheap
  // for a household this size, and far simpler than patching local state.
  useEffect(() => {
    const channel = supabase
      .channel('events-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => load()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  function eventsFor(day) {
    return events.filter((e) => {
      const d = new Date(e.starts_at)
      return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
      )
    })
  }

  function colorFor(ownerId) {
    return people.find((p) => p.id === ownerId)?.color ?? 'var(--muted)'
  }

  return (
    <div className="week">
      <header className="week-head">
        <h1>{weekLabel(anchor)}</h1>
        <div className="nav">
          <button className="ghost" onClick={() => setAnchor(addDays(anchor, -7))}>
            ‹
          </button>
          <button className="ghost" onClick={() => setAnchor(startOfWeek(new Date()))}>
            Today
          </button>
          <button className="ghost" onClick={() => setAnchor(addDays(anchor, 7))}>
            ›
          </button>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}

      <div className="grid">
        {days.map((day) => (
          <section
            key={day.toISOString()}
            className={isToday(day) ? 'day today' : 'day'}
          >
            <div className="day-head">
              <span className="dow">{dayName(day)}</span>
              <span className="dom">{day.getDate()}</span>
            </div>

            <div className="day-body">
              {eventsFor(day).map((e) => (
                <button
                  key={e.id}
                  className={e.read_only ? 'event locked' : 'event'}
                  style={{ borderLeftColor: colorFor(e.owner_id) }}
                  onClick={() => !e.read_only && setEditing(e)}
                >
                  {!e.all_day && (
                    <span className="event-time">
                      {timeLabel(new Date(e.starts_at))}
                    </span>
                  )}
                  <span className="event-title">{e.title}</span>
                </button>
              ))}
            </div>

            <button
              className="add"
              onClick={() => setEditing({ _day: day, owner_id: profile.id })}
            >
              +
            </button>
          </section>
        ))}
      </div>

      {editing && (
        <EventDialog
          initial={editing}
          profile={profile}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function EventDialog({ initial, profile, people, onClose, onSaved }) {
  const isNew = !initial.id
  const base = initial._day ?? new Date(initial.starts_at)

  const [title, setTitle] = useState(initial.title ?? '')
  const [allDay, setAllDay] = useState(initial.all_day ?? false)
  const [when, setWhen] = useState(() => {
    if (initial.all_day) return toDateInputValue(base)
    if (isNew) {
      const d = new Date(base)
      d.setHours(18, 0, 0, 0)
      return toInputValue(d)
    }
    return toInputValue(new Date(initial.starts_at))
  })
  const [ownerId, setOwnerId] = useState(initial.owner_id ?? profile.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function toggleAllDay(next) {
    setAllDay(next)
    const current = when.includes('T') ? new Date(when) : new Date(`${when}T18:00`)
    setWhen(next ? toDateInputValue(current) : toInputValue(current))
  }

  async function save() {
    if (!title.trim()) return setError('Give it a title.')
    setBusy(true)
    setError(null)

    const startsAt = allDay ? new Date(`${when}T00:00`) : new Date(when)

    const payload = {
      household_id: profile.household_id,
      title: title.trim(),
      starts_at: startsAt.toISOString(),
      all_day: allDay,
      owner_id: ownerId,
    }

    const { error } = isNew
      ? await supabase.from('events').insert(payload)
      : await supabase.from('events').update(payload).eq('id', initial.id)

    setBusy(false)
    if (error) setError(error.message)
    else onSaved()
  }

  async function remove() {
    setBusy(true)
    const { error } = await supabase.from('events').delete().eq('id', initial.id)
    setBusy(false)
    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'New event' : 'Edit event'}</h2>

        <input
          autoFocus
          placeholder="What is it?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />

        <input
          type={allDay ? 'date' : 'datetime-local'}
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />

        <label className="row">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => toggleAllDay(e.target.checked)}
          />
          <span>All day</span>
        </label>

        <div className="chips">
          {people.map((p) => (
            <button
              key={p.id}
              className={p.id === ownerId ? 'chip on' : 'chip'}
              style={{ borderColor: p.color }}
              onClick={() => setOwnerId(p.id)}
            >
              {p.display_name}
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {!isNew && (
            <button className="ghost danger" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
