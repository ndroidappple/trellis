import { ChecklistRow } from './ChecklistRow'
import { SkeletonRows } from './Skeleton'
import AddRow from './AddRow'

/**
 * Assembles chores into the shapes SectionPanel.css already has rules for.
 * Called twice from Wall.jsx — once per mode — since Board needs both
 * regardless of which is on screen.
 *
 * Two kinds of row live here, and they answer different questions.
 *
 * A scheduled or one-off chore is a checkbox: "has this been done this week".
 * An 'anytime' chore is a log: "when was this last done, and whose turn is
 * it". The dishwasher is never done — it is only more or less recently done —
 * and forcing it into a checkbox is what made it untickable in practice.
 *
 * Those two kinds used to be interleaved in one flat list, told apart only by
 * the colour of a left border. They are now grouped (see groupChores), which
 * is what lets a tap mean one thing per group instead of one thing per row.
 */

function ChoreRow({
  chore,
  done,
  creditedTo,
  initials,
  when,
  draggingId,
  onToggle,
  onDragStart,
  onOpenSettings,
}) {
  return (
    <div
      className={['panel-row', draggingId === chore.id ? 'is-dragging' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* A handle, not a long press on the row. touch-action: none here is
          what stops iPadOS reading the drag as a scroll of the list, while
          the rest of the row still scrolls. */}
      <button
        type="button"
        className="panel-row__grip"
        aria-label={`Reschedule ${chore.title}`}
        onPointerDown={(e) => onDragStart?.(chore, e)}
      >
        <span aria-hidden="true">⠿</span>
      </button>

      <ChecklistRow
        id={chore.id}
        label={chore.title}
        done={done}
        person={creditedTo ?? undefined}
        initials={initials}
        onToggle={onToggle}
      />

      {/* The row's one secondary door. It was three — a schedule pill, a
          drag handle and a delete × crowded into a ~350px column beside the
          primary tap, with the destructive one adjacent to the quiet one.
          Now the label opens a sheet that holds everything the row is not
          for: what kind of chore this is, which day, and deleting it. */}
      <button
        type="button"
        className="panel-row__when"
        onClick={() => onOpenSettings?.(chore)}
        aria-label={`Settings for ${chore.title}`}
      >
        {when}
      </button>
    </div>
  )
}

function EpisodicRow({
  chore,
  last,
  ago,
  turn,
  people,
  slotFor,
  initialsForPerson,
  when,
  onLog,
  onOpenSettings,
}) {
  // "Ed, yesterday" is the whole argument settled in three words. Without a
  // last completion there is nothing to report, and saying so beats an empty
  // gap that reads as a rendering failure.
  const history = last?.completed_by_name
    ? [last.completed_by_name, ago].filter(Boolean).join(', ')
    : 'not done yet'

  return (
    <div className="panel-row panel-row--episodic">
      <div className="panel-row__body">
        <span className="panel-row__title">{chore.title}</span>
        <span className="panel-row__meta">
          <span>{history}</span>
          {turn && (
            <span className="panel-row__turn" data-person={slotFor(turn)}>
              {`${turn.display_name}’s turn`}
            </span>
          )}
        </span>
      </div>

      {/*
        One button per person, rather than a checkbox plus a separate "who"
        step.

        The wall is a single signed-in session shared by two people, so
        crediting whoever the iPad happens to be logged in as would make the
        log confidently wrong — and this log exists to settle exactly the
        argument it would then be lying about. Naming both people turns
        attribution into the same tap as completion.

        Each button carries that person's own initial and that person's own
        colour. Both used to render the combined "NE": initialsForPerson takes
        the positional slot 'a' | 'b' | 'shared', and this passed it a whole
        profile row, so neither branch matched and every button fell through
        to the both-of-them fallback. The one control built to tell Nick and
        Ed apart could not tell Nick and Ed apart.
      */}
      <div className="panel-row__whodunit">
        {people.map((p) => {
          const slot = slotFor(p)
          const isTurn = turn?.id === p.id
          return (
            <button
              key={p.id}
              type="button"
              className={isTurn ? 'whodunit whodunit--turn' : 'whodunit'}
              data-person={slot}
              onClick={() => onLog?.(chore, p.id)}
              aria-label={`${p.display_name} did ${chore.title}`}
            >
              {initialsForPerson(slot)}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="panel-row__when"
        onClick={() => onOpenSettings?.(chore)}
        aria-label={`Settings for ${chore.title}`}
      >
        {when}
      </button>
    </div>
  )
}

export default function ChoresPanel({
  mode,
  loading,
  groups = [],
  choreCount = 0,
  choreIsDone,
  personFor,
  initialsForPerson,
  slotFor,
  people = [],
  onToggle,
  onLog,
  onAdd,
  onOpenSettings,
  commonChores = [],
  onDragStart,
  draggingId,
  scheduleLabelFor,
  lastDoneFor,
  turnFor,
  agoFor,
  pendingCount = 0,
  allDone = false,
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
    const pending = groups
      .filter((g) => g.kind === 'check')
      .flatMap((g) => g.chores)
      .filter((c) => !choreIsDone(c))

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
    <>
      {/* Dropping a chore back here unschedules it — see useChoreDrag. */}
      <div className="panel-rows" data-drop-backlog="">
        {choreCount === 0 && <p className="muted">Nothing yet.</p>}

        {groups.map((group) => (
          <section key={group.key} className="chore-group">
            <h3 className="chore-group__head">
              <span>{group.label}</span>
              {group.kind === 'check' && (
                <span className="chore-group__count">
                  {group.chores.filter((c) => !choreIsDone(c)).length} left
                </span>
              )}
            </h3>

            {group.chores.map((c) => {
              const last = lastDoneFor?.(c.id) ?? null

              if (group.kind === 'log') {
                return (
                  <EpisodicRow
                    key={c.id}
                    chore={c}
                    last={last}
                    ago={agoFor?.(last?.on_date) ?? null}
                    turn={turnFor?.(c, last) ?? null}
                    people={people}
                    slotFor={slotFor}
                    initialsForPerson={initialsForPerson}
                    when={scheduleLabelFor?.(c)}
                    onLog={onLog}
                    onOpenSettings={onOpenSettings}
                  />
                )
              }

              const done = choreIsDone(c)
              const creditedTo = done && last?.completed_by ? personFor(last.completed_by) : null

              return (
                <ChoreRow
                  key={c.id}
                  chore={c}
                  done={done}
                  creditedTo={creditedTo}
                  initials={creditedTo ? initialsForPerson(creditedTo) : undefined}
                  when={scheduleLabelFor?.(c)}
                  draggingId={draggingId}
                  onToggle={() => onToggle(c)}
                  onDragStart={onDragStart}
                  onOpenSettings={onOpenSettings}
                />
              )
            })}
          </section>
        ))}

        {/* Inside the scroll on purpose: a long palette costs the list
            nothing, because it scrolls away with the chores rather than
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
      </div>

      {/* Outside the scroll, unlike the palette. Capture was the least
          reachable control in the panel — below every chore and below the
          palette — so adding a chore to a full list meant scrolling to the
          bottom of it first. Pinned, it costs one row of list height and is
          always exactly where it was last time. */}
      <AddRow placeholder="Add a chore" onAdd={onAdd} />

      {pendingCount === 0 && choreCount > 0 && (
        <p className="panel-rows__footnote">Nothing left this week.</p>
      )}
    </>
  )
}
