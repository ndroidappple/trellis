import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Drives both lists. `kind` is 'shopping' or 'todo' and matches the `list`
 * column, so the shopping list here is the same row set Snap Pea will append
 * generated groceries to. There is deliberately only ever one of each.
 */
export default function ListCard({ kind, label, profile }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('list_items')
      .select('*')
      .eq('list', kind)
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else {
      setItems(data ?? [])
      setError(null)
    }
  }, [kind])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`list-${kind}-sync`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_items' },
        () => load()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load, kind])

  const remaining = items.filter((i) => !i.checked).length

  async function toggle(item) {
    const next = !item.checked
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, checked: next } : x)))
    const { error } = await supabase
      .from('list_items')
      .update({ checked: next })
      .eq('id', item.id)
    if (error) {
      setError(error.message)
      load()
    }
  }

  async function add(body) {
    const { error } = await supabase.from('list_items').insert({
      household_id: profile.household_id,
      list: kind,
      body,
      added_by: profile.id,
    })
    if (error) setError(error.message)
    else load()
  }

  async function remove(item) {
    setItems((xs) => xs.filter((x) => x.id !== item.id))
    await supabase.from('list_items').delete().eq('id', item.id)
  }

  async function clearChecked() {
    const ids = items.filter((i) => i.checked).map((i) => i.id)
    if (ids.length === 0) return
    setItems((xs) => xs.filter((x) => !x.checked))
    await supabase.from('list_items').delete().in('id', ids)
  }

  return (
    <>
      <button className="dock-card" onClick={() => setOpen(true)}>
        <span className="dock-label">{label}</span>
        <span className="dock-value">{remaining}</span>
      </button>

      {open && (
        <ListPanel
          label={label}
          items={items}
          error={error}
          onToggle={toggle}
          onAdd={add}
          onRemove={remove}
          onClearChecked={clearChecked}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ListPanel({
  label, items, error,
  onToggle, onAdd, onRemove, onClearChecked, onClose,
}) {
  const [body, setBody] = useState('')

  // Unchecked on top in the order they were added, checked collected below.
  const open = items.filter((i) => !i.checked)
  const done = items.filter((i) => i.checked)

  function submit() {
    if (!body.trim()) return
    onAdd(body.trim())
    setBody('')
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="card panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{label}</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="chore-list">
          {items.length === 0 && <p className="muted">Empty. Add something below.</p>}

          {open.map((i) => (
            <Row key={i.id} item={i} onToggle={onToggle} onRemove={onRemove} />
          ))}

          {done.length > 0 && (
            <div className="divider">
              <span className="muted">{done.length} done</span>
              <button className="ghost small-wide" onClick={onClearChecked}>
                Clear
              </button>
            </div>
          )}

          {done.map((i) => (
            <Row key={i.id} item={i} onToggle={onToggle} onRemove={onRemove} />
          ))}
        </div>

        <div className="add-row">
          <input
            autoFocus
            placeholder={`Add to ${label.toLowerCase()}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button onClick={submit}>Add</button>
        </div>
      </div>
    </div>
  )
}

function Row({ item, onToggle, onRemove }) {
  return (
    <div className={item.checked ? 'chore done' : 'chore'}>
      <button className="check" onClick={() => onToggle(item)}>
        {item.checked ? '✓' : ''}
      </button>

      <span className="chore-title">
        {item.body}
        {/* Items Snap Pea generates land here with a non-manual source. */}
        {item.source !== 'manual' && <span className="tag">{item.source}</span>}
      </span>

      <button className="ghost small" onClick={() => onRemove(item)}>✕</button>
    </div>
  )
}
