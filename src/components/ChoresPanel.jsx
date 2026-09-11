import { ChecklistRow } from './ChecklistRow'
import SwipeAway from './SwipeAway'
import { SkeletonRows } from './Skeleton'
import AddRow from './AddRow'
import { priorityLabel } from '../lib/capture'

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
  late,
  priority,
  progress,
  isChild = false,
  draggingId,
  creditLabel,
  onToggle,
  onCycleCredit,
  onDragStart,
  onOpenSettings,
  onRemove,
}) {
  return (
    <SwipeAway onDelete={onRemove ? () => onRemove(chore) : undefined}>
    <div
      className={[
        'panel-row',
        isChild ? 'panel-row--child' : '',
        late ? 'panel-row--late' : '',
        draggingId === chore.id ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* A handle, not a long press on the row. touch-action: none here is
          what stops iPadOS reading the drag as a scroll of the list, while
          the rest of the row still scrolls. A subtask has no handle: it
          belongs to its parent, and dragging it onto a day on its own would
          be dragging it out of the thing that gives it meaning. */}
      {!isChild && (
        <button
          type="button"
          className="panel-row__grip"
          aria-label={`Reschedule ${chore.title}`}
          data-no-swipe
          onPointerDown={(e) => onDragStart?.(chore, e)}
        >
          <span aria-hidden="true">⠿</span>
        </button>
      )}

      {/* The badge is only a correction target when there is a credit to
          correct — an unticked chore has nobody on it, and offering to change
          who did a thing nobody has done yet is a control with no meaning. */}
      <ChecklistRow
        id={chore.id}
        label={chore.title}
        done={done}
        person={creditedTo ?? undefined}
        initials={initials}
        onToggle={onToggle}
        onCreditPress={creditedTo ? onCycleCredit : undefined}
        creditLabel={creditLabel}
      />

      {/* Priority as weight, not as a colour scale. Two people sharing a wall
          do not need a four-grade traffic light, and red-amber-green on an
          always-on display in a living room is a nag rather than a signal. */}
      {priority && (
        <span className="panel-row__priority" data-level={chore.priority} aria-label={`Priority ${chore.priority} of 3`}>
          {priority}
        </span>
      )}

      {progress && <span className="panel-row__progress">{progress}</span>}

      {/* The row's one secondary door. It was three — a schedule pill, a
          drag handle and a delete × crowded into a ~350px column beside the
          primary tap, with the destructive one adjacent to the quiet one.
          Now the label opens a sheet that holds everything the row is not
          for: kind, day, priority, notes, subtasks and deleting. */}
      <button
        type="button"
        className={late ? 'panel-row__when is-late' : 'panel-row__when'}
        onClick={() => onOpenSettings?.(chore)}
        aria-label={`Settings for ${chore.title}`}
      >
        {when}
      </button>
    </div>
    </SwipeAway>
  )
}

function EpisodicRow({
  chore,
  last,
  ago,
  turn,
  todayIso,
  people,
  slotFor,
  initialsForPerson,
  when,
  onLog,
  onOpenSettings,
  onRemove,
}) {
  /*
   * Who is *selected* on this row, which is not the same as whose turn it is.
   *
   * Filled means "this is recorded" everywhere else in the app — it is the
   * rule `.card .chip.on` exists to enforce, after unselected chips once
   * rendered as the loud ones and inverted a whole control. This row broke it
   * again in the other direction: the fill was on whoever was up *next*, so a
   * row reading "Ed, yesterday · Nick's turn" put the solid badge on Nick, who
   * by that row's own account had not done it.
   *
   * The genuinely selected state is today's completion. logChore upserts on
   * (chore_id, on_date), so there is exactly one credited person per day and
   * tapping the other corrects it — which is precisely what a selected control
   * should look and behave like. Whose turn it is stays a hint, carried by the
   * text and a quiet ring, because a hint is not a selection.
   */
  const creditedToday = last && last.on_date === todayIso ? last.completed_by : null
  // "Ed, yesterday" is the whole argument settled in three words. Without a
  // last completion there is nothing to report, and saying so beats an empty
  // gap that reads as a rendering failure.
  const history = last?.completed_by_name
    ? [last.completed_by_name, ago].filter(Boolean).join(', ')
    : 'not done yet'

  return (
    <SwipeAway onDelete={onRemove ? () => onRemove(chore) : undefined}>
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
          const done = creditedToday === p.id
          // A turn is only worth pointing at while the thing is still
          // outstanding. Once today's run is recorded, the selected badge is
          // the whole story and a second marker beside it is just noise.
          const isTurn = !creditedToday && turn?.id === p.id

          return (
            <button
              key={p.id}
              type="button"
              className={[
                'whodunit',
                done ? 'whodunit--on' : '',
                isTurn ? 'whodunit--turn' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-person={slot}
              aria-pressed={done}
              onClick={() => onLog?.(chore, p.id)}
              aria-label={
                done
                  ? `${p.display_name} did ${chore.title} today`
                  : `${p.display_name} did ${chore.title}`
              }
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
    </SwipeAway>
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
  onCycleCredit,
  peopleById,
  onAdd,
  onOpenSettings,
  commonChores = [],
  onDragStart,
  onRemove,
  draggingId,
  scheduleLabelFor,
  dueLabelFor,
  lastDoneFor,
  turnFor,
  agoFor,
  today,
  todayIso,
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
          <section key={group.key} className="chore-group" data-group={group.key}>
            <h3 className="chore-group__head">
              <span>{group.label}</span>
              {group.kind === 'check' && (
                <span className="chore-group__count">
                  {group.chores.filter((c) => !choreIsDone(c)).length}
                  {group.key === 'overdue' ? ' late' : ' left'}
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
                    todayIso={todayIso}
                    people={people}
                    slotFor={slotFor}
                    initialsForPerson={initialsForPerson}
                    when={scheduleLabelFor?.(c)}
                    onLog={onLog}
                    onOpenSettings={onOpenSettings}
                    onRemove={onRemove}
                  />
                )
              }

              const rowFor = (chore, isChild) => {
                const isDone = choreIsDone(chore)
                const lastFor = lastDoneFor?.(chore.id) ?? null
                const credited =
                  isDone && lastFor?.completed_by ? personFor(lastFor.completed_by) : null
                const kids = chore.children ?? []

                /* Spelled out for the screen reader and the long-press
                   tooltip, because a single initial in a coloured circle says
                   who but gives no hint that it is also a control. */
                const creditNames = (peopleById ?? []).map((p) => p.display_name)
                const creditedName = (peopleById ?? []).find(
                  (p) => p.id === lastFor?.completed_by
                )?.display_name
                const otherName = creditNames.find((n) => n !== creditedName)
                const creditLabel =
                  credited && creditedName && otherName
                    ? `Done by ${creditedName}. Tap to credit ${otherName} instead.`
                    : 'Change who is credited'

                return (
                  <ChoreRow
                    key={chore.id}
                    chore={chore}
                    isChild={isChild}
                    done={isDone}
                    creditedTo={credited}
                    initials={credited ? initialsForPerson(credited) : undefined}
                    // A dated task says how late or how soon; everything else
                    // says what kind of rhythm it is on.
                    when={dueLabelFor?.(chore) ?? scheduleLabelFor?.(chore)}
                    late={group.key === 'overdue'}
                    priority={priorityLabel(chore.priority)}
                    progress={
                      kids.length > 0
                        ? `${kids.filter((k) => choreIsDone(k)).length}/${kids.length}`
                        : null
                    }
                    draggingId={draggingId}
                    creditLabel={creditLabel}
                    onToggle={() => onToggle(chore)}
                    onCycleCredit={() => onCycleCredit?.(chore)}
                    onDragStart={onDragStart}
                    onOpenSettings={onOpenSettings}
                    onRemove={onRemove}
                  />
                )
              }

              return (
                <div key={c.id} className="chore-item">
                  {rowFor(c, false)}
                  {(c.children ?? []).map((child) => rowFor(child, true))}
                </div>
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
      <AddRow
        placeholder="Add a task — try “bins out every tuesday”"
        onAdd={onAdd}
        parse
        today={today}
        collapsible
        openLabel="Add a task"
      />

      {pendingCount === 0 && choreCount > 0 && (
        <p className="panel-rows__footnote">Nothing left this week.</p>
      )}
    </>
  )
}
