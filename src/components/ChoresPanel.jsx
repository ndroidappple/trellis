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
  onDragStart,
  draggingId,
  scheduleLabelFor,
  isScheduled,
  lastDoneFor,
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
    // Dropping a chore back here unschedules it — see useChoreDrag.
    <div className="panel-rows" data-drop-backlog="">
      {chores.length === 0 && <p className="muted">Nothing yet.</p>}
      {chores.map((c) => {
        const scheduled = isScheduled?.(c) ?? false
        const last = lastDoneFor?.(c.id) ?? null
        const done = choreIsDone(c)

        // Four states to tell apart, so they are split across two channels
        // rather than crammed into one: the tick carries done/not-done, and
        // the label carries scheduled/unscheduled. A scheduled chore names
        // its day; an unscheduled one says so plainly instead of going
        // blank, because blank reads as "no information" rather than "not
        // scheduled".
        const when = [
          scheduleLabelFor?.(c),
          last?.completed_by_name ? (done ? last.completed_by_name : `last: ${last.completed_by_name}`) : null,
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <div
            key={c.id}
            className={[
              'panel-row',
              scheduled ? 'panel-row--scheduled' : 'panel-row--loose',
              draggingId === c.id ? 'is-dragging' : '',
            ].filter(Boolean).join(' ')}
          >
            {/* A handle, not a long press on the row. touch-action: none
                here is what stops iPadOS reading the drag as a scroll of
                the list, while the rest of the row still scrolls. */}
            <button
              type="button"
              className="panel-row__grip"
              aria-label={`Reschedule ${c.title}`}
              onPointerDown={(e) => onDragStart?.(c, e)}
            >
              <span aria-hidden="true">⠿</span>
            </button>

            <ChecklistRow
              id={c.id}
              label={c.title}
              when={when || undefined}
              done={done}
              person={c.assignee_id ? personFor(c.assignee_id) : undefined}
              initials={c.assignee_id ? initialsForPerson(personFor(c.assignee_id)) : undefined}
              onToggle={() => onToggle(c)}
            />
            <button className="panel-row__remove" onClick={() => onRemove(c)} aria-label={`Remove ${c.title}`}>
              ×
            </button>
          </div>
        )
      })}
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
