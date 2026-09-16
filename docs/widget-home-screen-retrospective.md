# Widget home screen: retrospective, and the dashboard path forward

## Status

Abandoned, not merged. `main` was never touched by this effort — the
entire thing lived on `worktree-widget-home-screen`, which stays around
unmerged as a reference (see "Disposition of the branch" below), not
because any of it is expected to ship as written.

## What was attempted

Four phases plus same-day bugfixes, all on `worktree-widget-home-screen`,
aiming to replace the board's fixed week+dock layout with a widget grid a
person could drag and resize, iOS-Home-Screen style:

- **Phase 0** — a `liquid-gooey` de-risking spike for the animation library
  Phase 4 would later use, desktop-only. The real-iPad go/no-go this phase
  existed to produce was never obtained before the whole direction was
  overtaken by the pivot below — flagged as an open risk from day one and
  never actually closed.
- **Phase 1** — the widget-grid mechanism itself: an integer-cell layout
  (`useWidgetGrid.js`), drag via `useWidgetDrag.js`, resize via
  `useWidgetResize.js`, reject-and-snap-back collision handling, and
  `WidgetGrid.tsx`/`WidgetTile.tsx` replacing `SectionDock`/`SectionPanel`.
- **Phase 2** — Home (lights/scenes, Feature #18) added as a fourth grid
  widget, reusing its existing mocked device/scene data.
- **Phase 3** — To-Do/Shopping tile-shaping: a `useWidgetSizeTier` hook
  measured a tile's rendered size and picked one of three render tiers
  (`micro`/`compact`/`full`) instead of the old full/compact *setting*.
- **Phase 4** — `liquid-gooey` drag-lift/settle and resize-bend animation
  on top of the Phase 1 mechanism.
- **A same-day pivot**, triggered by this effort's *first* real-hardware
  contact: continuous free-drag resize was replaced with a short list of
  named, discrete sizes per widget (again, iOS Home Screen widgets' own
  model) — a long press opens a menu naming the options instead of a drag
  gesture. This is also when the branch's whole premise started to look
  wrong; see "Why this is being set aside" below.

**Two real bugs surfaced in that same first-contact session**, both fixed
before the direction itself was reconsidered:

1. Long-pressing a widget with no "open" button (Calendar, which has no
   full page) opened Settings instead of the new size menu. This app
   already had a board-wide "hold anywhere → Settings" gesture that
   explicitly excludes `button, input, a, label` so it never fights a
   control's own gesture — the new long-press target was a plain `<div>`
   (Calendar has nothing to make it a real button), wasn't in that
   exclusion list, and lost the race.
2. In portrait, To-Do and Shopping silently vanished from the board despite
   being switched on. The actual household's live `board_settings.
   widgetLayout`, pulled directly from Supabase to diagnose this, predated
   even the numbers just written into the new size-preset table — Calendar
   had shipped at one height, then grown by a row in a later tweak, and the
   dock was sized and positioned against the *older*, shorter Calendar.
   The layout-sanitizing function started snapping every placement to its
   nearest preset unconditionally on every load; snapping Calendar up into
   the extra row it hadn't had when the dock was placed introduced a
   collision that hadn't existed a moment before, and the (correctly
   working) collision check silently dropped both dock widgets. Fixed by
   only touching a stored size when it's actually invalid, not just
   "not an exact preset match" — restoring the restraint that function had
   always had before presets existed.

## What actually worked

Worth keeping in mind if any piece of this is ever revisited:

- **The pure grid math held up.** `useWidgetGrid.js`'s placement/collision/
  bounds functions were solid across all four phases and never had a bug
  of their own — the one collision-related failure above was a caller-side
  design flaw (snapping unconditionally), not a defect in the math itself.
- **The drag lift/settle animation technique was a genuinely clean
  solution** to a real constraint: it layered a CSS transform/transition on
  top of *unchanged* grid placement rather than switching position schemes
  mid-gesture, which meant it never touched the WebKit pointer-capture
  behavior that had already broken real touch dragging once before on
  actual hardware (mutating `pointer-events` on an ancestor of a captured
  pointer target). Any future animation work on a gesture-driven surface in
  this app should keep that constraint in mind.
- **The long-press-to-manage pattern fit.** Opening a size menu on hold,
  leaving tap for the obvious action, matches this app's own established
  interaction language (see CLAUDE.md's "Hold a thing to manage it" —
  meals, chores, and events already work this way).

## Why this is being set aside

Not a bug list — the actual root cause. Four phases of grid math, gesture
handling, and animation-library integration happened before this effort
ever got its first look on the real device. When that look finally
happened, next to the actual iPad Home Screen dashboard in daily use, the
gap wasn't in the numbers — it was in the premise. A user-rearrangeable
widget grid was never what was wanted; what was wanted was a curated,
information-dense dashboard, with meal planning and chores as the clear
hero content. That is a different design question than "how do you drag
and resize a tile," and no amount of tuning the grid math would have
closed it.

**The lesson for next time:** for a visual/layout-driven change, validate
the visual target — ideally with a real mockup, ideally seen on the actual
device — before investing in the mechanism that would render it. This
project already practices exactly this discipline for uncertain numbers
("first-guess, verify on hardware" is a running theme across this whole
codebase); it wasn't applied to the *shape of the feature itself* here,
only to its constants.

## Disposition of the branch

`worktree-widget-home-screen` stays as-is, unmerged. Deleting it buys
nothing — keeping it costs nothing and preserves a working reference for
the grid math and the animation technique above, if either is ever wanted
on its own terms, decoupled from the free-drag-resize premise that didn't
survive contact with the real thing.

## Path forward: toward a curated dashboard

Grounded in what's actually on `main` today, checked directly rather than
assumed:

- **`Board.tsx`'s layout is a hardcoded two-region split** — the week grid
  plus `SectionDock`, which itself hardcodes exactly two children (Chores,
  Shopping — no config list, no map, two literal JSX slots). Feature #18
  was already kept off the board once before for exactly this reason (see
  `docs/feature-backlog.md`'s Feature #18 entry: "`SectionDock` hardcodes
  exactly two children... adding a third would mean redesigning that
  component, not just adding content to it"). A dashboard-card layout needs
  a real replacement for this component — but a **fixed, curated
  arrangement of a known card set**, not a rearrangeable grid. That's a
  substantially simpler engineering problem than what was just set aside:
  no drag, no resize, no collision math, no animation-library integration,
  just a responsive arrangement of cards whose set and order the app
  decides, not the person looking at it.
- **Meal planning has no dedicated view today.** A meal is one chip inside
  a day row, the same visual weight as any calendar event, collapsing into
  plain text the moment a day goes "past." There's real prior art already
  in the tree, though orphaned: `src/components/MealsCard.jsx` is a
  complete, unused component — a full week-by-week meal list, a budget
  projection, a recipe-picker search — never wired into `Wall.jsx` and
  built against CSS classes (`.dock-card`, `.card.panel`) that predate the
  current Board/tokens system. Worth mining for content and structure
  ideas for a real "Meals" hero card, not re-importing directly — its
  data-fetching would need to be reconciled with `Wall.jsx`'s existing
  `mealPlan`/`recipes`/`staples` state rather than duplicating it.
- **Chores/To-Do already has real prominence** via its own dock panel.
  Giving it more is more a visual-weight question than a missing-feature
  one — exactly the kind of thing a mockup should settle before code does.
- **Smart Home (Feature #18) is a complete UI shell with no real backend**
  — confirmed still true on `main`: no `devices` table, no Home Assistant
  integration, no real Sonos control, nothing that toggling a tile actually
  reaches. Promoting it to a dashboard card would honestly be a restyle of
  the existing mock content (room tabs, four scenes, tap/hold-to-dim device
  tiles) into a smaller glance card — not new functionality — unless the
  backend work already scoped in the backlog's own "if this becomes real"
  section (a `devices` table with RLS, realtime sync, a Home Assistant
  proxy Edge Function) is separately commissioned. Worth being explicit
  about this wherever the card appears, in keeping with this app's existing
  rule against ever showing a false "Live" state.
- **Weather has zero existing code** — only a thorough spec, Feature #4 in
  the backlog. Worth weighing before building a dedicated card: that spec's
  own architecture section calls for a lightweight, *non-dominant* first
  pass, and separately flags the not-yet-built ambient-screensaver "Sky"
  theme as arguably the best-fit home for weather in this app precisely
  because it never has to compete for board real estate at all. That
  doesn't rule out a dashboard card — it's the backlog's own prior
  thinking, worth a fresh look rather than silently overriding. If a card
  is still wanted, the spec is clear that it needs a server-side proxy/
  cache (a Supabase Edge Function) — never a client-side call with an
  embedded API key.

### Recommended immediate next step

A visual mockup — the card hierarchy: meal planning and chores as hero
content, the calendar alongside rather than dominating, Weather and Smart
Home as smaller glance cards, all in the existing warm palette
(`--slat-face`/`--plaster`/`--ink` family — confirmed staying, not moving
to the screenshot's dark theme). This is the retrospective's own lesson
applied directly: settle the visual target before writing the `Board.tsx`
restructuring that would render it. That restructuring is real work and
deserves its own planning pass once the mockup says what's actually being
built, rather than being scoped sight-unseen here.
