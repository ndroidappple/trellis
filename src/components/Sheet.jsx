/**
 * A full-screen layer, for the two surfaces that are lists rather than forms.
 *
 * Split by content weight, not uniformly. The day view and the recipe picker
 * are lists that want room — as dialogs they scrolled inside a box inside a
 * scrim, which is two nested scroll contexts under one finger and always
 * feels wrong. The event editor and settings stay dialogs: both are short
 * forms where the board behind them is useful context, and a full-screen
 * takeover to set "Shopping: compact" would be theatre.
 *
 * The transition is 180ms. Long enough to establish that a layer arrived
 * rather than the page swapping, short enough that nobody waits for it.
 */
export default function Sheet({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header className="sheet__head">
        <div className="sheet__titles">
          <h2 className="sheet__title">{title}</h2>
          {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
        </div>

        {/* Full-screen means the board is no longer visible behind you, so
            the way back has to be explicit — a scrim tap isn't available
            once there's no scrim. */}
        <button className="sheet__close" onClick={onClose} aria-label="Close">
          Done
        </button>
      </header>

      <div className="sheet__body">{children}</div>

      {footer && <div className="sheet__footer">{footer}</div>}
    </div>
  )
}
