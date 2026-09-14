/**
 * A full-screen layer, for surfaces with enough content that a dialog would
 * squeeze them — lists, and now a settings surface that outgrew one.
 *
 * Split by content weight, not uniformly. The day view and the recipe picker
 * are lists that want room — as dialogs they scrolled inside a box inside a
 * scrim, which is two nested scroll contexts under one finger and always
 * feels wrong. Settings joined them once it grew past a handful of rows
 * (root list plus four drill-down categories) — at that size a dialog would
 * have been the "Shopping: compact" theatre this used to warn against, but a
 * *short* form still isn't: the event editor and chore sheet stay dialogs,
 * because both are one screen's worth of fields where the board behind them
 * is useful context and there's nowhere to drill down to.
 *
 * The transition is 180ms. Long enough to establish that a layer arrived
 * rather than the page swapping, short enough that nobody waits for it. A
 * caller that mounts a fresh `Sheet` per view (a different `key`, e.g.
 * Settings swapping categories) gets this same cue on every navigation for
 * free, since it's just a normal mount.
 */
export default function Sheet({ title, subtitle, onClose, onBack, backLabel, children, footer }) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header className="sheet__head">
        <div className="sheet__titles">
          {/* Only on a drill-down page — the root of a sheet has nowhere to
              go back to, and "Done" already closes it from anywhere. */}
          {onBack && (
            <button className="sheet__back" onClick={onBack}>
              ‹ {backLabel ?? 'Back'}
            </button>
          )}
          <h2 className="sheet__title">{title}</h2>
          {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
        </div>

        {/* Full-screen means the board is no longer visible behind you, so
            the way back has to be explicit — a scrim tap isn't available
            once there's no scrim. Stays present even on a drill-down page:
            closing the whole thing should never require backing out one
            level at a time. */}
        <button className="sheet__close" onClick={onClose} aria-label="Close">
          Done
        </button>
      </header>

      <div className="sheet__body">{children}</div>

      {footer && <div className="sheet__footer">{footer}</div>}
    </div>
  )
}
