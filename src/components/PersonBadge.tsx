import './PersonBadge.css';

export type Person = 'a' | 'b' | 'shared';

interface Props {
  person: Person;
  /** 'N', 'E', 'NE' — falls back to this until portrait SVGs land. */
  initials: string;
  /** Full name, for screen readers and for the settings screen. */
  name?: string;
  size?: number;
}

/**
 * The ownership marker. Colour plus initials, so it survives at kitchen
 * distance and doesn't depend on hue alone.
 *
 * The portrait work (docs/backlog-person-avatars.md) replaces the initials
 * with an SVG here and nowhere else.
 */
export function PersonBadge({ person, initials, name, size }: Props) {
  const style = size
    ? { width: size, height: size, fontSize: Math.round(size * 0.5) }
    : undefined;

  return (
    <span
      className={`person-badge person-badge--${person}`}
      style={style}
      title={name}
      aria-label={name ?? initials}
    >
      {initials}
    </span>
  );
}
