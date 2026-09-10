import './MainMenu.css'

/**
 * The board's front door.
 *
 * Until now there wasn't one. The header carried a single "Recipes" button
 * wedged between the sync dot and the week arrows, the To-Do and Shopping
 * pages could only be reached by tapping the head of their dock panel, and
 * settings were behind an undocumented 650ms long-press on the background.
 *
 * That arrangement had three problems, and the middle one is a bug:
 *
 *   - Every new room had to find somewhere to live in a header whose other
 *     controls are all about moving around *this* week. A doorway filed among
 *     the navigation for the room you are already in is a doorway nobody
 *     reads as one.
 *   - **Switching a dock section to Off removed the only route to its page.**
 *     The panel head *is* the door, and `SectionPanel` returns null at Off, so
 *     a household that turned Shopping off to free up board space also lost
 *     per-row delete, "clear ticked", and the named list of unpriced
 *     ingredients — none of which exist anywhere else. A layout preference
 *     quietly took away data.
 *   - Nothing pointed at settings at all, so the way to undo that was a
 *     gesture you had to already know about.
 *
 * So: one labelled door, and behind it every room plus the one thing you are
 * most likely to have come for. It stays a dialog rather than becoming a full
 * sheet — it is six rows, and the board showing through behind them is the
 * point. You have not left yet.
 */
export default function MainMenu({
  cook,
  choresCount,
  shoppingCount,
  sections,
  onCook,
  onRecipes,
  onChores,
  onShopping,
  onSettings,
  onClose,
}) {
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="menu__title">Trellis</h2>

        {/*
          The shortest path in the app, and the reason this menu is worth
          having rather than merely tidy.
          
          Cook mode used to sit three layers deep — open the book, find the
          recipe among eighteen, press Cook — even on the night the board
          already knew what dinner was. That is a search you are made to
          perform for an answer the app is currently displaying. When tonight
          has a meal with a method written down, it goes at the top and it goes
          in one tap.

          It is deliberately the only row here that isn't a room: everything
          below is a place, this is an errand, which is why it is fenced off
          above them rather than filed among them.
        */}
        {cook && (
          <div className="menu__group">
            <span className="menu__heading">{cook.heading}</span>
            <button className="menu__row menu__row--go" onClick={onCook}>
              <span className="menu__row-label">{cook.label}</span>
              <span className="menu__row-meta">{cook.meta}</span>
            </button>
          </div>
        )}

        <div className="menu__group">
          <span className="menu__heading">Rooms</span>

          {/* Also on the header as its own button — the book is opened often
              enough to earn both. It stays listed here so the menu is a
              complete index of where you can go, rather than a list of the
              places that did not get a shortcut. */}
          <button className="menu__row" onClick={onRecipes}>
            <span className="menu__row-label">Recipe book</span>
            <span className="menu__row-meta">Search, filter, plan a night, cook</span>
          </button>

          {/* The counts ride along because the menu is on the way to
              everywhere, and a number you can read without opening the room
              is sometimes the whole reason you were going. They also say
              plainly when a section is switched off, so the thing that
              stranded these pages before now announces itself here. */}
          <button className="menu__row" onClick={onChores}>
            <span className="menu__row-label">Weekly To Do</span>
            <span className="menu__row-meta">
              {choresCount ?? 'Loading…'}
              {sections?.chores === 'off' && ' · hidden on the board'}
            </span>
          </button>

          <button className="menu__row" onClick={onShopping}>
            <span className="menu__row-label">Shopping</span>
            <span className="menu__row-meta">
              {shoppingCount ?? 'Loading…'}
              {sections?.shopping === 'off' && ' · hidden on the board'}
            </span>
          </button>
        </div>

        <div className="menu__group">
          <span className="menu__heading">Board</span>

          <button className="menu__row" onClick={onSettings}>
            <span className="menu__row-label">Settings</span>
            <span className="menu__row-meta">Panels, header aside, screen timeout</span>
          </button>
        </div>

        <button className="menu__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
