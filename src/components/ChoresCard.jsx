import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { startOfWeek } from '../lib/week'

/**
 * A weekly chore is done if it was completed inside the current week. That
 * comparison is the whole reset mechanism — on Monday the week start moves and
 * every weekly chore reads as unchecked again. Nothing runs on a schedule.
 */
function isDone(chore, weekStart) {
  if (!chore.completed_at) return false
  if (chore.recurrence === 'once') return true
  return new Date(chore.completed_at) >= weekStart
}

export default function ChoresCard({ profile, people }) {
  const [chores, setChores] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  const weekStart = startOfWeek(new Date())

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('chores')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else {
      setChores(data ?? [])
      setError(null)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('chores-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chores' },
        () => load()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  const done = chores.filter((c) => isDone(c, weekStart)).length

  async function toggle(chore) {
    const next = isDone(chore, weekStart) ? null : new Date().toISOString()
    // Optimistic: the wall should feel instant even on a slow connection.
    setChores((cs) =>
      cs.map((c) => (c.id === chore.id ? { ...c, completed_at: next } : c))
    )
    const { error } = await supabase
      .from('chores')
      .update({ completed_at: next })
      .eq('id', chore.id)
    if (error) {
      setError(error.message)
      load()
    }
  }

  /** Cycle unassigned -> first person -> second person -> unassigned. */
  async function cycleAssignee(chore) {
    const ids = [null, ...people.map((p) => p.id)]
    const next = ids[(ids.indexOf(chore.assignee_id ?? null) + 1) % ids.length]

    setChores((cs) =>
      cs.map((c) => (c.id === chore.id ? { ...c, assignee_id: next } : c))
    )
    await supabase.from('chores').update({ assignee_id: next }).eq('id', chore.id)
  }

  async function add(title, recurrence) {
    const { error } = await supabase.from('chores').insert({
      household_id: profile.household_id,
      title,
      recurrence,
      sort_order: chores.length,
    })
    if (error) setError(error.message)
    else load()
  }

  async function remove(chore) {
    setChores((cs) => cs.filter((c) => c.id !== chore.id))
    await supabase.from('chores').delete().eq('id', chore.id)
  }

  return (
    <>
      <button className="dock-card" onClick={() => setOpen(true)}>
        <span className="dock-label">Chores</span>
        <span className="dock-value">
          {done}<span className="dock-of"> / {chores.length}</span>
        </span>
      </button>

      {open && (
        <ChoresPanel
          chores={chores}
          people={people}
          weekStart={weekStart}
          error={error}
          onToggle={toggle}
          onCycle={cycleAssignee}
          onAdd={add}
          onRemove={remove}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ChoresPanel({
  chores, people, weekStart, error,
  onToggle, onCycle, onAdd, onRemove, onClose,
}) {
  const [title, setTitle] = useState('')
  const [recurrence, setRecurrence] = useState('weekly')

  function submit() {
    if (!title.trim()) return
    onAdd(title.trim(), recurrence)
    setTitle('')
  }

  function initials(id) {
    const p = people.find((x) => x.id === id)
    return p ? p.display_name.slice(0, 2) : '—'
  }

  function colorFor(id) {
    return people.find((x) => x.id === id)?.color ?? 'var(--line)'
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Chores</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="chore-list">
          {chores.length === 0 && (
            <p className="muted">Nothing yet. Add the first one below.</p>
          )}

          {chores.map((c) => {
            const complete = isDone(c, weekStart)
            return (
              <div key={c.id} className={complete ? 'chore done' : 'chore'}>
                <button className="check" onClick={() => onToggle(c)}>
                  {complete ? '✓' : ''}
                </button>

                <span className="chore-title">
                  {c.title}
                  {c.recurrence === 'once' && <span className="tag">one-off</span>}
                </span>

                <button
                  className="who"
                  style={{ borderColor: colorFor(c.assignee_id) }}
                  onClick={() => onCycle(c)}
                  title="Tap to reassign"
                >
                  {initials(c.assignee_id)}
                </button>

                <button className="ghost small" onClick={() => onRemove(c)}>
                  ✕
                </button>
              </div>
            )
          })}
        </div>

        <div className="add-row">
          <input
            placeholder="Add a chore"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button
            className={recurrence === 'weekly' ? 'chip on' : 'chip'}
            onClick={() => setRecurrence(recurrence === 'weekly' ? 'once' : 'weekly')}
          >
            {recurrence === 'weekly' ? 'Weekly' : 'One-off'}
          </button>
          <button onClick={submit}>Add</button>
        </div>
      </div>
    </div>
  )
}
