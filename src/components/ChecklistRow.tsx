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
  /**
   * Tap the badge to hand the credit to someone else. Given only where that
   * question is answerable — a chore whose completion is logged against a
   * person. Shopping passes nothing and keeps a plain, inert badge.
   */
  onCreditPress?: () => void;
  /** "Done by Nick. Tap to credit Ed instead." */
  creditLabel?: string;
}

/**
 * The root is a div, not a button.
 *
 * It was a button, with the person badge rendered inside it — which made the
 * badge un-tappable by construction (a button inside a button is invalid, and
 * the click belonged to the row anyway). So on a shared wall the one piece of
 * information most likely to be wrong was also the one piece you could not
 * correct: tapping "N" to say it was actually Ed just un-ticked the chore.
 *
 * The toggle is now its own button filling everything up to the badge, so the
 * big easy target is unchanged for the common case, and the badge is a real
 * control sitting beside it rather than a label trapped inside it.
 */
export function ChecklistRow({
  id, label, when, done, person, initials, density = 'row', onToggle,
  onCreditPress, creditLabel,
}: Props) {
  const classes = [
    'checklist-row',
    `checklist-row--${density}`,
    done ? 'is-done' : '',
  ].filter(Boolean).join(' ');

  const badge = person
    ? <PersonBadge person={person} initials={initials ?? ''} />
    : null;

  return (
    <div className={classes}>
      <button
        type="button"
        className="checklist-row__toggle"
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
      </button>

      {badge && (onCreditPress ? (
        <button
          type="button"
          className="checklist-row__credit"
          onClick={onCreditPress}
          aria-label={creditLabel}
          title={creditLabel}
        >
          {badge}
        </button>
      ) : badge)}
    </div>
  );
}
