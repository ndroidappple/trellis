/**
 * Feature #18 — Home. Device/scene icon glyphs, shared between HomeSheet
 * (the full room) and HomeWidget (the board tile) so both render the exact
 * same set from one source rather than two copies that could drift.
 */

const ICON_PATHS = {
  lamp: <path d="M9 2h6l3 7H6l3-7zm3 9v7m-3 3h6" />,
  ceiling: <path d="M12 2v4m-7 7a7 7 0 0 1 14 0H5zm3 3h8" />,
  strip: <path d="M3 8h18v4H3zM7 12v4m5-4v4m5-4v4" />,
  plug: <path d="M9 2v6m6-6v6M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8zm6 9v5" />,
  fan: (
    <path
      strokeWidth="1.6"
      d="M12 12c0-4 2-6 4-5s1 5-4 5zm0 0c4 0 6 2 5 4s-5 1-5-4zm0 0c0 4-2 6-4 5s-1-5 4-5zm0 0c-4 0-6-2-5-4s5-1 5 4z"
    />
  ),
  speaker: <path strokeWidth="1.8" d="M6 3h12v18H6zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z" />,
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M8 5v14" />
    </>
  ),
  pot: <path d="M4 9h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9zM8 6V4m4 2V4m4 2V4" />,
}

export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {ICON_PATHS[name]}
    </svg>
  )
}
