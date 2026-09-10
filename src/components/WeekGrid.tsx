import { EventChip, type EventChipData } from './EventChip';
import { SkeletonChips } from './Skeleton';
import { visibleChipCount, type DetailLevel } from '../hooks/useDetailLevel';
import type { Person } from './PersonBadge';
import './WeekGrid.css';

export interface DayData {
  /** ISO date, used as the key. */
  date: string;
  /** 3 for "March 3". */
  dayOfMonth: number;
  /** "Sun" normally, "Tuesday" when it's today. */
  dayOfWeek: string;
  shortDayOfWeek: string;
  isToday: boolean;
  /**
   * Already happened. Drives the recession in WeekGrid.css — see the note
   * there for why the past dims rather than shrinks.
   */
  isPast?: boolean;
  events: EventChipData[];
  /**
   * Whether this day still has a meal slot free. Computed by Wall, because
   * how many slots a day has and which are taken is a fact about the meal
   * plan — the grid only needs to know whether to offer the button.
   *
   * It used to be derived here as "no meal chip on this row", which was the
   * right answer while a day could only hold a dinner. Once it can hold four,
   * that test hides the button as soon as breakfast is planned.
   */
  canAddMeal?: boolean;
}

interface Props {
  days: DayData[];
  level: DetailLevel;
  /** Placeholders instead of the empty state, until real data has landed. */
  loading?: boolean;
  initialsFor?: (person: Person) => string;
  onEventPress?: (id: string) => void;
  /** The design has no other way to create an event, so a day tap needs one. */
  onAddDay?: (date: string) => void;
  /** Shown only on days with no meal chip yet. */
  onAddMeal?: (date: string) => void;
  /** Opens the whole day. The row itself is the target, so a tap anywhere
      that isn't already a control gets there. */
  onOpenDay?: (date: string) => void;
  /** A chore is in flight; rows show they can take it. */
  dragging?: boolean;
  /** The row currently under the pointer. */
  dragOverDate?: string | null;
}

function DayRow({ day, level, loading, initialsFor, onEventPress, onAddDay, onAddMeal, onOpenDay, dragging, dragOver }: {
  day: DayData;
  level: DetailLevel;
  loading?: boolean;
  initialsFor?: (person: Person) => string;
  onEventPress?: (id: string) => void;
  onAddDay?: (date: string) => void;
  onAddMeal?: (date: string) => void;
  onOpenDay?: (date: string) => void;
  dragging?: boolean;
  dragOver?: boolean;
}) {
  const limit = visibleChipCount(level);
  const shown = day.events.slice(0, limit);
  const hidden = day.events.length - shown.length;

  const openDay = () => onOpenDay?.(day.date);

  /** Controls inside the row keep their own action instead of falling
      through to the row's "open this day". */
  const only = (fn: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    fn();
  };

  return (
    <section
      className={[
        'day-row',
        day.isToday ? 'day-row--today' : '',
        day.isPast ? 'day-row--past' : '',
        dragging ? 'is-drop-target' : '',
        dragOver ? 'is-drop-over' : '',
      ].filter(Boolean).join(' ')}
      // Read by useChoreDrag's hit test. On the element rather than in
      // React state so the hook needs to know nothing about the board.
      data-drop-day={day.date}
      onClick={openDay}
    >
      {/* A real button so the day is reachable by keyboard and to AT, since
          the row itself is a plain region with a convenience click. */}
      <button
        type="button"
        className="day-row__rail"
        aria-label={`Open ${day.dayOfWeek} ${day.dayOfMonth}`}
        onClick={only(openDay)}
      >
        <span className="day-row__dom">{day.dayOfMonth}</span>
        <span className="day-row__dow">
          {day.isToday ? day.dayOfWeek : day.shortDayOfWeek}
        </span>
        {day.isToday && <span className="day-row__badge">Today</span>}
      </button>

      <div className="day-row__events">
        {/* While loading, the row shows placeholders instead of its empty
            state — "Nothing planned" on a week that hasn't arrived yet is a
            statement of fact the board has no business making. */}
        {loading && <SkeletonChips count={day.isToday ? 2 : 1} />}

        {!loading && shown.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            level={level}
            initialsFor={initialsFor}
            onPress={onEventPress}
          />
        ))}

        {/* Was a plain span, which made everything it counted unreachable:
            on a busy day at the tight level the collapsed events could not
            be opened, seen, or even counted accurately by tapping. */}
        {!loading && hidden > 0 && (
          <button
            type="button"
            className="day-row__more"
            aria-label={`Show ${hidden} more on ${day.dayOfWeek} ${day.dayOfMonth}`}
            onClick={only(openDay)}
          >
            +{hidden} more
          </button>
        )}

        {/* An empty evening is information, but only worth saying when
            there's room to say it. */}
        {!loading && level === 'open' && day.events.length <= 1 && (
          <span className="day-row__invite">
            {day.events.length === 0 ? 'Nothing planned' : 'Nothing else planned'}
          </span>
        )}

        {/* "Meal", not "Dinner". The button wrote a dinner and said so, which
            was honest right up until the day could hold a breakfast, a lunch
            and a snack as well — at which point the label would have been the
            only thing still insisting there was one meal a night. Dinner is
            still what it pre-selects; it just no longer claims to be all a day
            can have. */}
        {!loading && onAddMeal && day.canAddMeal !== false && (
          <button
            type="button"
            className="day-row__add-meal"
            aria-label={`Plan a meal on ${day.dayOfMonth}`}
            onClick={only(() => onAddMeal(day.date))}
          >
            + Meal
          </button>
        )}

        {!loading && onAddDay && (
          <button
            type="button"
            className="day-row__add"
            aria-label={`Add event on ${day.dayOfMonth}`}
            onClick={only(() => onAddDay(day.date))}
          >
            +
          </button>
        )}
      </div>
    </section>
  );
}

export function WeekGrid({ days, level, loading, initialsFor, onEventPress, onAddDay, onAddMeal, onOpenDay, dragging, dragOverDate }: Props) {
  return (
    <div className="week-grid">
      {days.map((day) => (
        <DayRow
          key={day.date}
          day={day}
          level={level}
          loading={loading}
          initialsFor={initialsFor}
          onEventPress={onEventPress}
          onAddDay={onAddDay}
          onAddMeal={onAddMeal}
          onOpenDay={onOpenDay}
          dragging={dragging}
          dragOver={dragOverDate === day.date}
        />
      ))}
    </div>
  );
}
