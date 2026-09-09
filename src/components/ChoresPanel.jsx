import { ChecklistRow } from './ChecklistRow'
import { SkeletonRows } from './Skeleton'
import AddRow from './AddRow'

/**
 * Assembles chores into the shapes SectionPanel.css already has rules for:
 * panel-rows (full) and panel-strip (compact). Called twice from Wall.jsx —
 * once per mode — since Board needs both regardless of which is on screen.
 *
 * Two kinds of row live here, and they answer different questions.
 *
 * A scheduled or one-off chore is a checkbox: "has this been done this week".
 * An 'anytime' chore is a log: "when was this last done, and whose turn is
 * it". The dishwasher is never done — it is only more or less recently done —
 * and forcing it into a checkbox is what made it untickable in practice.
 */
export default function ChoresPanel({
  mode,
  loading,
  chores,
  choreIsDone,
  personFor,
  initialsForPerson,
  people = [],
  onToggle,
  onLog,
  onAdd,
  onRemove,
  onReschedule,
  commonChores = [],
  onDragStart,
  draggingId,
  scheduleLabelFor,
  isScheduled,
  isEpisodic,
  lastDoneFor,
  turnFor,
  agoFor,
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
    // An episodic chore is never "pending" — it has no outstanding state to
    // summarise — so the strip stays a list of what is actually outstanding
    // rather than permanently carrying the dishwasher.
    const pending = chores.filter((c) => !isEpisodic?.(c) && !choreIsDone(c))
    const trackable = chores.filter((c) => !isEpisodic?.(c))
    const allDone = trackable.length > 0 && pending.length === 0

    return (
      <div className="panel-strip">
        {pending.slice(0, 4).map((c) => (
          <span key={c.id} className="panel-chip">
            {c.title}
          </span>
        ))}
        {pending.length > 4 && <span className="muted">+{pending.length - 4}</span>}
        {allDone && <span className="muted">All done</span>}
      </div>
    )
  }

  return (
    // Dropping a chore back here unschedules it — see useChoreDrag.
    <div className="panel-rows" data-drop-backlog="">
      {chores.length === 0 && <p className="muted">Nothing yet.</p>}

      {chores.map((c) => {
        const episodic = isEpisodic?.(c) ?? false
        const last = lastDoneFor?.(c.id) ?? null
        const ago = agoFor?.(last?.on_date) ?? null

        if (episodic) {
          const turn = turnFor?.(c, last) ?? null

          // "Ed, yesterday" is the whole argument settled in three words.
          // Without a last completion there is nothing to report, and saying
          // so beats an empty gap that reads as a rendering failure.
          const history = last?.completed_by_name
            ? [last.completed_by_name, ago].filter(Boolean).join(', ')
            : 'not done yet'

          return (
            <div
              key={c.id}
              className={[
                'panel-row',
                'panel-row--episodic',
                draggingId === c.id ? 'is-dragging' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="panel-row__body">
                <span className="panel-row__title">{c.title}</span>
                {/* "As needed" leads because without it the row is silent
                    about what kind of chore this is: no checkbox and no day
                    reads as missing information rather than as a deliberate
                    absence of schedule. Then the log, then the turn — which
                    is last because it is the thing being looked for, and
                    carries its own weight to be found. */}
                <span className="panel-row__meta">
                  <span>{scheduleLabelFor?.(c)}</span>
                  <span>{history}</span>
                  {turn && (
                    <span className="panel-row__turn">{`${turn.display_name}’s turn`}</span>
                  )}
                </span>
              </div>

              {/*
                One button per person, rather than a checkbox plus a separate
                "who" step.

                The wall is a single signed-in session shared by two people,
                so crediting whoever the iPad happens to be logged in as would
                make the log confidently wrong — and this log exists to settle
                exactly the argument it would then be lying about. Naming both
                people turns attribution into the same tap as completion.

                The person whose turn it is leads, but the other is always
                available: doing it out of turn is normal and must not be
                harder to record than doing it in turn.
              */}
              <div className="panel-row__whodunit">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={turn && turn.id === p.id ? 'whodunit whodunit--turn' : 'whodunit'}
                    onClick={() => onLog?.(c, p.id)}
                    aria-label={`${p.display_name} did ${c.title}`}
                  >
                    {initialsForPerson(p)}
                  </button>
                ))}
              </div>

              <button
                className="panel-row__remove"
                onClick={() => onRemove(c)}
                aria-label={`Remove ${c.title}`}
              >
                ×
              </button>
            </div>
          )
        }

        const scheduled = isScheduled?.(c) ?? false
        const done = choreIsDone(c)
        const creditedTo = done && last?.completed_by ? personFor(last.completed_by) : null

        // Four states to tell apart, so they are split across two channels
        // rather than crammed into one: the tick carries done/not-done, and
        // the label carries scheduled/unscheduled. A scheduled chore names
        // its day; an unscheduled one says so plainly instead of going
        // blank, because blank reads as "no information" rather than "not
        // scheduled".
        const when = scheduleLabelFor?.(c)

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

            {/* `when` deliberately not passed: it is rendered below as a
                tappable control instead, and showing it twice made the row
                read as two different facts. */}
            <ChecklistRow
              id={c.id}
              label={c.title}
              done={done}
              person={creditedTo ?? undefined}
              initials={creditedTo ? initialsForPerson(creditedTo) : undefined}
              onToggle={() => onToggle(c)}
            />

            {/* Drag was the only way to put a chore on a day, which on a
                wall-mounted iPad means hauling a row from a scrolling dock
                panel up across the whole screen to a target that may not
                even be on screen. Dragging still works exactly as it did;
                this is simply a second door, and the only one that exists
                for anyone who cannot drag. */}
            <button
              type="button"
              className="panel-row__when"
              onClick={() => onReschedule?.(c)}
              aria-label={`Change when ${c.title} happens`}
            >
              {when}
            </button>

            <button
              className="panel-row__remove"
              onClick={() => onRemove(c)}
              aria-label={`Remove ${c.title}`}
            >
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
