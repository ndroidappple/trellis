import { EventChip, type EventChipData } from './EventChip';
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
  events: EventChipData[];
}

interface Props {
  days: DayData[];
  level: DetailLevel;
  initialsFor?: (person: Person) => string;
  onEventPress?: (id: string) => void;
  /** The design has no other way to create an event, so a day tap needs one. */
  onAddDay?: (date: string) => void;
  /** Shown only on days with no meal chip yet. */
  onAddMeal?: (date: string) => void;
}

function DayRow({ day, level, initialsFor, onEventPress, onAddDay, onAddMeal }: {
  day: DayData;
  level: DetailLevel;
  initialsFor?: (person: Person) => string;
  onEventPress?: (id: string) => void;
  onAddDay?: (date: string) => void;
  onAddMeal?: (date: string) => void;
}) {
  const limit = visibleChipCount(level);
  const shown = day.events.slice(0, limit);
  const hidden = day.events.length - shown.length;
  const hasMeal = day.events.some((e) => e.kind === 'meal');

  return (
    <section className={`day-row${day.isToday ? ' day-row--today' : ''}`}>
      <div className="day-row__rail">
        <span className="day-row__dom">{day.dayOfMonth}</span>
        <span className="day-row__dow">
          {day.isToday ? day.dayOfWeek : day.shortDayOfWeek}
        </span>
        {day.isToday && <span className="day-row__badge">Today</span>}
      </div>

      <div className="day-row__events">
        {shown.map((event) => (
          <EventChip
            key={event.id}
            event={event}
            level={level}
            initialsFor={initialsFor}
            onPress={onEventPress}
          />
        ))}

        {hidden > 0 && <span className="day-row__more">+{hidden} more</span>}

        {/* An empty evening is information, but only worth saying when
            there's room to say it. */}
        {level === 'open' && day.events.length <= 1 && (
          <span className="day-row__invite">
            {day.events.length === 0 ? 'Nothing planned' : 'Nothing else planned'}
          </span>
        )}

        {onAddMeal && !hasMeal && (
          <button
            type="button"
            className="day-row__add-meal"
            aria-label={`Plan dinner on ${day.dayOfMonth}`}
            onClick={() => onAddMeal(day.date)}
          >
            + Dinner
          </button>
        )}

        {onAddDay && (
          <button
            type="button"
            className="day-row__add"
            aria-label={`Add event on ${day.dayOfMonth}`}
            onClick={() => onAddDay(day.date)}
          >
            +
          </button>
        )}
      </div>
    </section>
  );
}

export function WeekGrid({ days, level, initialsFor, onEventPress, onAddDay, onAddMeal }: Props) {
  return (
    <div className="week-grid">
      {days.map((day) => (
        <DayRow
          key={day.date}
          day={day}
          level={level}
          initialsFor={initialsFor}
          onEventPress={onEventPress}
          onAddDay={onAddDay}
          onAddMeal={onAddMeal}
        />
      ))}
    </div>
  );
}
