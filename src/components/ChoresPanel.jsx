import { ChecklistRow } from './ChecklistRow'
import { SkeletonRows } from './Skeleton'
import AddRow from './AddRow'

/**
 * Assembles chores into the shapes SectionPanel.css already has rules for:
 * panel-rows (full) and panel-strip (compact). Called twice from Wall.jsx —
 * once per mode — since Board needs both regardless of which is on screen.
 */
export default function ChoresPanel({
  mode,
  loading,
  chores,
  choreIsDone,
  personFor,
  initialsForPerson,
  onToggle,
  onAdd,
  onRemove,
  commonChores = [],
}) {
  if (loading) {
    return mode === 'compact' ? (
      <div className="panel-strip">
        <SkeletonRows count={1} />
      </div>
    ) : (
      <div className="panel-rows">
        <SkeletonRows count={4} />
      </div>
    )
  }

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
      {/* Full mode only, on purpose: compact is a four-chip summary read from
          across the room, and adding tap targets to it would turn a glance
          into a control panel.

          These sit inside .panel-rows, which scrolls, so a long palette
          costs the list nothing — it scrolls with the chores rather than
          stealing height from them. */}
      {commonChores.length > 0 && (
        <div className="panel-quick">
          {commonChores.map((title) => (
            <button key={title} className="panel-quick__chip" onClick={() => onAdd(title)}>
              {title}
            </button>
          ))}
        </div>
      )}

      <AddRow placeholder="Add a chore" onAdd={onAdd} />
    </div>
  )
}
