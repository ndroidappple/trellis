# Widget-based home screen (Board redesign) + `liquid-gooey`

**Status:** Phase 0 (de-risking spike) and Phase 1 (widget-grid mechanism)
are built and verified — see `worktree-widget-home-screen` branch,
commits `f1e983b` and `42ae7c0`. Phases 2–5 below are not started.

## Context

The persistent Board — the always-on view on the counter iPad — is currently a
fixed layout: a week grid (calendar) plus a hardcoded 2-panel dock (Weekly
To-Do, Shopping). Home hub controls (lights/scenes) exist only as a separate
full-screen room reached through the menu, and are explicitly a UI shell today
(`lib/home.js`'s `INITIAL_DEVICES`/`SCENES` are mock data — no Supabase table,
no realtime, resets on every reload).

The ask is to turn this into a real widget-based home screen: Calendar,
Weekly To-Do, Shopping, and a new Home-hub-controls widget, all live on the
board as draggable, resizable tiles — plus adopting `liquid-gooey` (a small,
new npm package for gooey/liquid SVG-filter effects) to give the interactions
more physicality.

This directly reopens a decision the project already made once. Feature #18's
own backlog entry records two rejected prototypes — one embedding Home
controls on the board, one as a dedicated room — and picked the dedicated
room specifically because `SectionDock` (`SectionPanel.tsx`) hardcodes
exactly two children, and Feature #17 had just spent a full pass tuning the
board's landscape vertical-space budget (834pt) for exactly those two panels,
with one documented case fitting by "roughly 6px — closer to a rounding error
than a margin," never verified on real hardware. Asked directly, the user
chose to reopen that decision anyway: fully embed Home as a true 4th widget,
keep it a UI shell (no real device backend), and make all widgets genuinely
drag-and-resize — the most ambitious of the options on all three axes. That
combination, plus a brand-new animation library, makes this the largest
single change the project has taken on: realistically **5–9 work sessions**,
not one sitting, and it should be communicated and scheduled that way rather
than attempted as a single pass.

`liquid-gooey` itself was checked against the npm registry before including
it here: `liquid-gooey@0.2.1`, real package, MIT, zero runtime deps, peer
deps `react>=18`/`react-dom>=18` (compatible with this app's React 19), no
install-time scripts. It is also very new — published ~2 weeks ago, 3 total
published versions, single maintainer — so it gets a validation spike before
anything depends on it, with a plain-CSS fallback at every use site.

## Phased rollout

Each phase should be its own PR/session boundary, in this order, because each
one only makes sense once the one before it is proven:

### Phase 0 — De-risking (before any board/Wall.jsx changes) — DONE
- **Get the real 11" iPad into the loop early**, not just at the end. Feature
  #17's own open items already flag the *current, simpler* 2-panel layout as
  unverified on real hardware with near-zero margin in one known case; this
  redesign adds a third widget, resize (a wholly new capability), and a new
  third-party library on top of that same tight budget. Hardware access is
  the single highest-leverage risk reducer available and should start now,
  not at Phase 4. **Still outstanding** — nothing in this project has been
  seen on the actual iPad yet.
- **`liquid-gooey` spike**: a throwaway component (`src/dev/gooey-spike.jsx`,
  not meant to ship, reachable via `?gooey-spike`) exercising its
  `morph`/`move`/`bend` effects. Go/no-go on: acceptable frame rate on real
  hardware (not desktop Safari), no memory growth across repeated interaction
  (the wall runs unattended for weeks), and that `prefers-reduced-motion` can
  actually be honored (see Phase 4). The package's own "zero idle cost" claim
  is self-reported — verify it, don't take it on faith, given this app's
  existing "nothing decorative loops" rule for the always-on screen. Built
  and desktop-verified (renders correctly, no console errors, effects fire as
  documented); **the actual go/no-go still needs the real iPad**. No-go means
  proceed with plain CSS transitions everywhere `liquid-gooey` was proposed —
  nothing else in this plan structurally depends on it.

### Phase 1 — Widget-grid mechanism (existing content only, nothing new) — DONE
The riskiest phase, done in isolation from any new content so failures are
attributable to the mechanism, not to Home being new.

- New `WidgetGrid.tsx`/`.css` replaces `Board.tsx`'s `.board__body`
  (`.board__week` + `SectionDock`) entirely.
- New `WidgetTile.tsx`/`.css` replaces `SectionPanel.tsx` as the generic tile
  chrome (title/count/open-door pattern carries over; the hardcoded-2-child
  `SectionDock` and its `pastShare`/`--past-share` negotiation are retired,
  not extended — see "What must not regress" below for why that's a
  deliberate simplification, not a gap).
- New `useWidgetGrid.js`: pure cell/collision/placement math (no DOM) — an
  integer cell grid per orientation (not free-form pixels, matching the
  app's existing preference for coarse, measured, discrete states over
  continuous scaling), each widget declaring a `minCellSpan` floor. This is
  the Phase 5 vitest target. `GRID_CONFIG`/`MIN_CELL_SPAN` were solved
  against `weekFloorFor`'s real worst case (696px), not guessed: 10 rows *
  56px + 9 * 16px gap = 704px, an 8px margin flagged in code as the same
  class of tight as Feature #17's known ~6px landscape case, not a safer one.
- New `useWidgetDrag.js`, mirroring `src/hooks/useChoreDrag.js`'s proven
  shape exactly: pointer-capture from an **explicit handle** (never the
  whole tile — tiles host live interactive content, the same reason
  `useChoreDrag` doesn't start from a long-press on the row), window-level
  `pointermove`/`pointerup`/`pointercancel`, `document.elementFromPoint`
  hit-testing against new `data-drop-cell="col,row"` markers. Not HTML5 DnD
  — `dragstart`/`dragover`/`drop` don't fire for touch on iPadOS, which is
  exactly why `useChoreDrag` exists in its current form.
- New `useWidgetResize.js` (kept separate from drag — genuinely different
  math): pointer-capture on a corner grip, clamps to `minCellSpan`. No
  resize concept exists anywhere in the app today; this is wholly new
  surface.
- **Entry point**: a new "Rearrange widgets" row in `MainMenu.jsx` (fits the
  existing pattern of a management action living behind Menu with a printed
  hint, like today's "Hold to change where it shows"). Not a long-press on
  the board background — that gesture is already claimed for Settings
  (`Wall.jsx`'s existing 650ms press handling).
- **Collision behavior**: reject-and-snap-back for v1, not auto-displacement.
  Auto-reflowing other widgets on a drop is a materially harder algorithm
  and this plan deliberately declines to take it on in the first pass, on a
  device with very little vertical slack to spare. Worth reconsidering once
  the basic mechanism is proven on hardware, not before.
- **Portrait vs. landscape**: two independent stored layouts
  (`board_settings.widgetLayout.portrait` / `.landscape`), not a coordinate
  transform between them — matches how the codebase already treats portrait
  and landscape as genuinely different layout problems with separate CSS
  paths, and avoids re-deriving a saved layout in a way that could violate a
  `minCellSpan` floor the way Feature #17's 6px case already did once.
- **Sync scope — household default + per-device override, following the
  screensaver-timeout precedent exactly** (`src/lib/screensaver.js`'s
  `readDeviceTimeout`/`writeDeviceTimeout`, `localStorage`, `null` = "follow
  household"). Household-wide default lives in `board_settings.widgetLayout`
  (jsonb — no migration needed: `Wall.jsx`'s existing
  `setSettings({ ...DEFAULT_SETTINGS, ...data.board_settings })` already
  absorbs it, the same pattern that already absorbed
  `screensaverMin`/`nightFromHour`), synced via the same realtime channel as
  today's dock modes. A **new `useViewportClass.js`** hook (phone-vs-wall-
  class size detection, built but not yet consumed anywhere — see "Not yet
  wired" below) gates this: wall-class devices consume the full
  `{x,y,w,h}` layout; phones should ignore position/size entirely and render
  a fixed single-column stack instead. A thin per-device `localStorage`
  override (`src/lib/widgetLayout.js`, same `null`-means-"follow household"
  shape) rides along for a wall-class device that wants its own arrangement.

**Phase 1 is done** when today's board (week grid + To-Do + Shopping, both
orientations) is fully reproduced through the new grid — draggable,
resizable, respecting floors — checked on the real iPad, not just a resized
browser window. **Built and verified in a dev harness** (`src/dev/board-spike.jsx`,
`?board-spike` — real auth needs an emailed code this session couldn't
receive): confirmed correct grid placement in both orientations via computed
styles, confirmed rearrange-mode wiring, confirmed a real dispatched
pointer-event resize gesture commits correctly. **Not yet checked on the
real iPad** — portrait's computed grid floor (1136px) is close to the
available viewport and needs that check before being trusted.

**Not yet wired, worth knowing before Phase 2:** `useViewportClass.js`
exists but nothing calls it yet — Board.tsx and WidgetGrid always render the
full draggable grid regardless of viewport size, so a phone visiting the
board today gets the same drag/resize grid as the iPad (undersized cells,
not the intended fixed single-column stack). Wiring this up is unfinished
Phase 1 scope, not a Phase 2 item — do it before or alongside Phase 2.

### Phase 2 — Home-hub-controls widget — NOT STARTED
- New `HomeWidget.jsx`/`.css`, reusing `src/lib/home.js` as-is (`ROOMS`,
  `INITIAL_DEVICES`, `SCENES`, `applyScene`, `groupByRoom`, `summaryFor`) —
  no new data layer, per the user's explicit choice to keep this a UI shell.
- **One real design decision worth flagging explicitly**: today
  `HomeSheet.jsx` owns its mock device state locally and resets to
  `INITIAL_DEVICES` every time the sheet opens — fine for an occasional
  room, but wrong once Home is a persistently-mounted widget (toggling a
  light on the widget, then opening the full Home room, would show it reset
  back to defaults — a more visible inconsistency than today's already-known
  "no persistence" gap). This plan hoists that mock state up into `Wall.jsx`
  (or a small `useMockHomeState.js`) so the widget and the full sheet agree
  within a session. Still 100% local `useState`, zero backend — just lifted
  one level so the two views of the same fake data can't disagree.
- Small tile: glance-only (`summaryFor` — "3 of 11 on" — plus maybe a "run
  last scene" action). Large tile: scene row + a capped device grid
  (`groupByRoom`, first N devices, "+N more → open Home"). Reuses
  `useLongPress` for tap-toggle/hold-to-dim exactly as `HomeTile` does today.
- Extract `Icon`/`ICON_PATHS` out of `HomeSheet.jsx` into a shared
  `src/components/homeIcons.jsx` so both components use the same SVG data.
- Reuses the existing `--lit`/`--lit-deep`/`--lit-tint` tokens as-is.
- Stays explicitly a UI shell: only the widget's position/on-off-in-grid
  state syncs via `board_settings.widgetLayout` like every other widget —
  device/scene content itself has zero Supabase/RLS/realtime. Worth a code
  comment at that seam so a future reader doesn't mistake the asymmetry
  (position synced, content not) for something unfinished.
- `useWidgetGrid.js` already has `home` entries in `MIN_CELL_SPAN`, but
  `defaultLayout()` deliberately never places one (see its own comment) —
  Phase 2 owns designing where Home actually fits, quite possibly by growing
  `GRID_CONFIG`'s row count rather than reusing the placeholder numbers.

### Phase 3 — `ChoresPanel`/`ShoppingPanel` tile-shaping — NOT STARTED
Today's `mode: 'full'|'compact'` is a **setting**, not a measurement — once a
widget can be dragged to any size, that stops working (a tile set to "full"
but dragged small would overflow). Phase 1 shipped with Board.tsx always
rendering "full" content regardless of tile size as an explicit stopgap —
small To-Do/Shopping tiles will overflow until this phase lands. Generalize
the same discrete-tier philosophy `useDetailLevel.ts` already proves out
(measured `ResizeObserver` + hysteresis bands, not continuous scaling) into a
new, smaller sibling hook, `useWidgetSizeTier.ts`, parameterized per widget
type:

- **Calendar** keeps `useDetailLevel`/`weightedRowsFor`/`weekFloorFor`
  exactly as they are — already re-pointed to the Calendar tile's own
  content area in Phase 1. Nothing further needed here.
- **To-Do/Shopping** get a new tier below today's `compact`: a `'micro'`
  glance tile (a single stat block, no per-item chips) for small tiles,
  `compact`'s `.panel-strip`/`.panel-chip` kept for wide-short tiles (needs
  new wrap/truncate CSS — today it assumes full dock width, not a
  narrow-tall shape), `full`'s scrollable list kept for large tiles.

### Phase 4 — `liquid-gooey` polish (only if Phase 0 said go) — NOT STARTED
Attempted in this order, each shippable independently, CSS-transition
fallback available at every step:
1. **Drag-lift/settle + invalid-drop snap-back** — wrap the dragged tile in
   `effect="move"`; an invalid drop (Phase 1's reject-and-snap-back) animates
   back via `bouncy` transition. Most contained, start here.
2. **Resize-handle feedback** — `effect="bend"` tied to pointer velocity
   while actively resizing.
3. **Widget → full-room morph** (the literal "shared-element" idea, highest
   value and highest risk) — replace `Sheet.jsx`'s flat fade+rise for the
   specific path of opening a widget's full room, morphing the tile's bounds
   into the sheet's. Real, unproven reconciliation between in-grid
   coordinates and the sheet's fixed full-viewport space. Attempt only after
   1–2 ship and read well; keep `Sheet.jsx`'s existing transition as the
   permanent fallback, not a temporary one.
4. **Home tile on/off toggle** — thematically the best fit (light "filling"
   the tile) but the most frequently tapped, most exposed surface. Attempt
   last, only if hardware profiling still shows headroom after 1–3.

Non-negotiable rules, restated as engineering constraints, not suggestions:
- **Interaction-triggered only.** Mount/animate a `<Liquid>` wrapper only for
  the duration of the actual gesture; tear down or freeze to static the
  instant it ends. Never leave one idly mounted through the 99% of wall-time
  nothing is being touched — the same "nothing decorative loops" rule that
  already governs every other animation in this app, and it applies even
  though the library claims "zero idle cost" itself — verify that under this
  app's real usage pattern rather than trusting the claim.
- **`prefers-reduced-motion` must be honored explicitly, in JS.**
  `tokens.css`'s existing `--dur-*` zeroing does not reach `liquid-gooey`'s
  own `transition` prop. Add `usePrefersReducedMotion.js` and gate every
  `Liquid.Item` call site on it — verify end-to-end in Phase 5, not just at
  the hook.

### Phase 5 — Testing, hardening, final hardware verification — NOT STARTED
- **vitest**, introduced here for real, closing a gap the project's own docs
  already flag as wanted (`cost.js`, `week.js`, `useToday` were already
  named as needing coverage). Scope: `useWidgetGrid`'s placement/collision
  logic, `useWidgetResize`'s clamping math, `useWidgetSizeTier`'s
  hysteresis state machine (mirroring `useDetailLevel`'s existing
  band-transition logic as the natural first test target). Not drag/pointer
  integration tests — no such infra exists yet, and pure-logic coverage is
  the actual documented gap. (Phase 1's grid math was manually smoke-tested
  in a Node REPL during development — those scenarios are a ready-made
  starting point for real test cases here.)
- **Manual checklist on the real 11" iPad** (not a resized browser window):
  both orientations, re-checking Feature #17's specific tightest-known case
  (landscape, nothing-past-yet) with whichever widgets ship on by default —
  the margin only gets tighter with more tiles, never looser; real
  finger-drag reposition and resize on glass; Nick and Ed signed in
  simultaneously (wall showing the household default, a phone showing its
  stacked view) to confirm the sync-vs-local hybrid behaves as designed;
  Auto-Lock still set to Never; a multi-hour soak test for memory growth
  from repeated interactions (a five-minute demo won't catch this, and the
  wall runs for weeks unattended); `prefers-reduced-motion` disabling every
  `liquid-gooey` site end to end; the full "what must not regress" list
  below run as an actual checklist.

## What must not regress

- **The week's gradient of relevance** (today warm/tall/dark-edged, past
  days receding via `--past-face`/`day-row--past`) stays fully intact
  *within* the Calendar widget. What deliberately goes away is the
  *cross-widget* space handoff — today `pastShare` lets the week grid give
  reclaimed height to the dock as the week empties out; in a
  user-positioned grid, each widget's span is fixed by explicit placement,
  not auto-renegotiated with its siblings. State this as a deliberate
  simplification in the PR description, not a silently dropped feature —
  manual drag/resize is the replacement for that automatic heuristic, not
  an oversight.
- **Min-height floor discipline**, everywhere new. Every `WidgetTile` and
  the `WidgetGrid` container itself need an explicit computed floor
  (mirroring `weekFloorFor`/`--week-floor`) — this guards against the
  project's own documented "already fixed once" bug class: flex/grid
  children silently clip via `overflow: hidden` with no visual sign when a
  floor is missing. That risk now exists once per widget type plus the grid
  container, not once.
- **Realtime sync for Calendar/To-Do/Shopping is unaffected** — their
  `useRealtimeTable` channels and `Wall.jsx`'s existing fetch/mutate
  functions don't move, only their rendering container does (`SectionPanel`
  → `WidgetTile`). Home stays the sole, explicitly-scoped exception.
- **The "open full room" door stays, unchanged in destination.** This plan
  does not remove `ToDoSheet`, `ShoppingSheet`, `RecipeBook`, `HomeSheet`, or
  `SettingsSheet`. Every `WidgetTile` keeps `SectionPanel`'s existing
  "whole head is the door" pattern. `Board.tsx`'s header (Recipes button,
  Home icon, Menu button) is untouched — Home's header icon exists
  specifically because it was asked for as one-tap access, which stays true
  even once Home also lives as a widget a household member might have
  turned off or scrolled away.

## Concrete file list

**New (Phase 0–1, shipped):** `src/hooks/useWidgetGrid.js`,
`useWidgetDrag.js`, `useWidgetResize.js`, `useViewportClass.js`;
`src/components/WidgetGrid.tsx`+`.css`, `WidgetTile.tsx`+`.css`;
`src/lib/widgetLayout.js`; `src/dev/gooey-spike.jsx`, `src/dev/board-spike.jsx`
(both throwaway dev harnesses, query-param gated, lazy-loaded).

**New (Phase 2–5, not yet built):** `useWidgetSizeTier.ts`,
`usePrefersReducedMotion.js`, `useMockHomeState.js`;
`HomeWidget.jsx`+`.css`, `homeIcons.jsx`; `useWidgetGrid.test.js`.

**Substantially rewritten (done):** `Board.tsx` (`.board__body` →
`<WidgetGrid>`, header untouched), `SectionPanel.tsx`/`.css` (deleted,
replaced by `WidgetTile`), `Wall.jsx` (new `widgetLayout` state extending
`DEFAULT_SETTINGS`, new props into `Board`), `MainMenu.jsx` (new "Rearrange
widgets" row).

**Substantially rewritten (not yet done):** `ChoresPanel.jsx`/
`ShoppingPanel.jsx` (new `'micro'` tier + tile-shape CSS — Phase 3),
`HomeSheet.jsx` (device state hoisted out — Phase 2).

**Lightly touched:** `useDetailLevel.ts` (unchanged internally, ref
re-pointed — done), `Sheet.jsx` (untouched until Phase 4's morph needs a
skip-own-transition mode), `tokens.css` (no changes needed so far),
`package.json` (`liquid-gooey` added Phase 0; `vitest` at Phase 5),
`App.css` (removed one now-dead `.section-dock[data-cols='1']` selector),
`CLAUDE.md`/`docs/feature-backlog.md` (still need updating to record that
Feature #18's "embedded rejected" decision was deliberately reversed here,
and why — not yet done).

**Migrations:** none required — `board_settings` is jsonb and `Wall.jsx`'s
existing default-merge already absorbs new keys with no schema change.
Optionally backfill a sensible default via a migration rather than relying
purely on client-side merge — worth doing, not required.

## Verification

- Run `npm run build` after each phase — it's the fastest compile-error
  check across this mixed .jsx/.tsx codebase (no standalone typecheck
  script exists). Clean through Phase 1.
- `npm run lint` (oxlint) — clean through Phase 1.
- Phase 5 adds `npx vitest run` for the new pure-logic modules.
- The manual hardware checklist in Phase 5 is the real acceptance test —
  browser verification (resizing a window, DevTools device emulation) can
  rule things in but has already been shown, twice, not to catch what
  matters on this specific device (Feature #17 and the screensaver feature
  both shipped with real hardware behavior as an open, unverified item).
  Get iPad access lined up starting in Phase 0, not saved for the end. This
  still hasn't happened as of Phase 1 — it's the single most important open
  item on this whole plan.
