import { PersonBadge, type Person } from './PersonBadge';
import './ChecklistRow.css';

interface Props {
  id: string;
  label: string;
  /** "Today", "Wednesday" — the chores list uses it, shopping doesn't. */
  when?: string;
  done: boolean;
  person?: Person;
  initials?: string;
  /** 'row' for chores, 'item' for the denser shopping grid. */
  density?: 'row' | 'item';
  onToggle?: (id: string, next: boolean) => void;
}

export function ChecklistRow({
  id, label, when, done, person, initials, density = 'row', onToggle,
}: Props) {
  const classes = [
    'checklist-row',
    `checklist-row--${density}`,
    done ? 'is-done' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      role="checkbox"
      aria-checked={done}
      onClick={() => onToggle?.(id, !done)}
    >
      <span className="checklist-row__box" aria-hidden="true">
        {done && (
          <svg viewBox="0 0 16 16" width="16" height="16">
            <path
              d="M3 8.5l3.2 3.2L13 5"
              fill="none"
              stroke="var(--person-ink)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <span className="checklist-row__name">
        {label}
        {when && <span className="checklist-row__when">{when}</span>}
      </span>

      {person && (
        <PersonBadge person={person} initials={initials ?? ''} />
      )}
    </button>
  );
}
