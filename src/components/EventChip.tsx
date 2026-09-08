import { PersonBadge, type Person } from './PersonBadge';
import type { DetailLevel } from '../hooks/useDetailLevel';
import './EventChip.css';

export interface EventChipData {
  id: string;
  title: string;
  /** Time or short qualifier — "2:30 PM", "Cooking — 35 min", "Leftovers". */
  meta?: string;
  /** Third line, shown only at the open level. */
  detail?: string;
  /** Omit for meals and household items with no single owner. */
  person?: Person;
  /** Meals opt out of the person system entirely and read as a material. */
  kind?: 'event' | 'meal';
}

interface Props {
  event: EventChipData;
  level: DetailLevel;
  initialsFor?: (person: Person) => string;
  onPress?: (id: string) => void;
}

const DEFAULT_INITIALS: Record<Person, string> = { a: 'N', b: 'E', shared: 'NE' };

export function EventChip({ event, level, initialsFor, onPress }: Props) {
  const { id, title, meta, detail, person, kind = 'event' } = event;
  const isMeal = kind === 'meal';
  const initials = person
    ? (initialsFor?.(person) ?? DEFAULT_INITIALS[person])
    : '';

  const classes = [
    'event-chip',
    isMeal ? 'event-chip--meal' : `event-chip--${person ?? 'shared'}`,
  ].join(' ');

  return (
    <button
      type="button"
      className={classes}
      // The row behind this opens the whole day; tapping a specific event
      // means that event, not the day it happens to sit in.
      onClick={(e) => {
        e.stopPropagation();
        onPress?.(id);
      }}
    >
      {!isMeal && person && <PersonBadge person={person} initials={initials} />}
      <span className="event-chip__body">
        <span className="event-chip__title">{title}</span>
        {meta && <span className="event-chip__meta">{meta}</span>}
        {detail && level === 'open' && (
          <span className="event-chip__detail">{detail}</span>
        )}
      </span>
    </button>
  );
}
