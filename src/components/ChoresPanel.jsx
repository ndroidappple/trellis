import { ChecklistRow } from './ChecklistRow'
import AddRow from './AddRow'

/**
 * Assembles chores into the shapes SectionPanel.css already has rules for:
 * panel-rows (full) and panel-strip (compact). Called twice from Wall.jsx —
 * once per mode — since Board needs both regardless of which is on screen.
 */
export default function ChoresPanel({
  mode,
  chores,
  choreIsDone,
  personFor,
  initialsForPerson,
  onToggle,
  onAdd,
  onRemove,
}) {
  if (mode === 'compact') {
    const pending = chores.filter((c) => !choreIsDone(c))
    const allDone = chores.length > 0 && pending.length === 0

    return (
      <div className="panel-strip">
        {pending.slice(0, 4).map((c) => (
          <span key={c.id} className="panel-chip">
            {c.title}
          </span>
        ))}
        {allDone && <span className="muted">All done</span>}
      </div>
    )
  }

  return (
    <div className="panel-rows">
      {chores.length === 0 && <p className="muted">Nothing yet.</p>}
      {chores.map((c) => (
        <div key={c.id} className="panel-row">
          <ChecklistRow
            id={c.id}
            label={c.title}
            when={c.recurrence === 'once' ? 'One-off' : undefined}
            done={choreIsDone(c)}
            person={c.assignee_id ? personFor(c.assignee_id) : undefined}
            initials={c.assignee_id ? initialsForPerson(personFor(c.assignee_id)) : undefined}
            onToggle={() => onToggle(c)}
          />
          <button className="panel-row__remove" onClick={() => onRemove(c)} aria-label={`Remove ${c.title}`}>
            ×
          </button>
        </div>
      ))}
      <AddRow placeholder="Add a chore" onAdd={onAdd} />
    </div>
  )
}
