# Widget-based home screen (Board redesign) + `liquid-gooey`

**Status:** Phase 0 (de-risking spike), Phase 1 (widget-grid mechanism),
Phase 2 (Home-hub-controls widget, plus the phone-stack wiring Phase 1 left
unfinished), Phase 3 (`ChoresPanel`/`ShoppingPanel` tile-shaping) and Phase 4
steps 1–2 (drag-lift/settle + snap-back, resize bend feedback) are built — see
`worktree-widget-home-screen` branch. Phase 4 proceeded on `liquid-gooey`
without ever getting the real-iPad go/no-go Phase 0 was meant to produce —
accepted explicitly, not silently.

**The real 11" iPad finally arrived in the loop** (see "Real-hardware
findings" under Phase 4 below) — the first genuine hardware data this whole
feature has had, after every phase saying it was still missing. It found the
bottom edge of the grid clipped in both orientations and no way to make
Calendar smaller, which reframed continuous free-drag resize into iOS-style
discrete size presets (see Phase 4's own section — this wasn't a new
numbered phase, it revised Phase 4's resize mechanism in place before steps
3–4 were ever attempted). Each phase passed `npm run build`/`npm run lint`;
interactive checks needing a signed-in session against the live household
account are noted per-phase where they haven't been attempted. Phase 4 steps
3–4 and Phase 5 below are not started.

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

**Two real bugs the desktop/mouse-based verification above never caught,
found on the actual iPad and fixed the same day:**
- `WidgetGrid.tsx` set `pointer-events: none` on the dragged/resized tile's
  own ancestor cell the instant a gesture started, to let the drop-cell
  hit-test overlay underneath receive `elementFromPoint` — but the overlay
  was already stacked above it by `z-index`, so that mutation was both
  unnecessary and the likely reason every touch drag/resize silently did
  nothing on real hardware: WebKit fires `pointercancel` when
  `pointer-events` changes on an element involved in an active touch
  sequence, including an ancestor of the element that just called
  `setPointerCapture()`. Removed; hit-testing still works purely from
  z-index.
- `useWidgetResize.js` called `onCommit(...)` — which reaches all the way up
  to the board-settings-owning component's `setState` — from *inside* the
  functional updater passed to `setResize`. React updaters must be pure;
  calling another component's setState from one is exactly what "Cannot
  update a component while rendering a different component" warns about,
  and under StrictMode's deliberate double-invocation of updaters (this app
  wraps everything in `<StrictMode>`) it could fire during a render pass
  instead of the `pointerup` handler. `useWidgetDrag.js` never had this —
  its `end()` already called `onDrop` as a plain statement after `setDrag`,
  not inside its updater, matching `useChoreDrag.js`'s proven shape exactly.
  Fixed by tracking the live delta in a ref (written as a plain assignment
  in the `move` handler, not inside any updater) and calling `onCommit`
  after a plain `setResize(null)`.

Both were reproducible from a desktop browser once looked for (dispatched
touch-type `PointerEvent`s plus watching the console), but neither showed up
during the original mouse-driven verification — worth remembering for
Phase 2 onward: mouse testing rules things in, it doesn't rule touch-specific
issues out.

**Wired in Phase 2** (was unfinished Phase 1 scope): `useViewportClass.js`
existed but nothing called it — Board.tsx and WidgetGrid always rendered the
full draggable grid regardless of viewport size, so a phone visiting the
board got the same drag/resize grid as the iPad (undersized cells, not the
intended fixed single-column stack). `Board.tsx` now branches on it; see
Phase 2's own section for what shipped and how it was verified.

### Phase 2 — Home-hub-controls widget — DONE
- New `HomeWidget.jsx`/`.css`, reusing `src/lib/home.js` as-is (`ROOMS`,
  `SCENES`, `applyScene`, `groupByRoom`, `summaryFor`) — no new data layer,
  per the user's explicit choice to keep this a UI shell.
- **The device-state design decision this section originally flagged is
  built**: `src/hooks/useMockHomeState.js` holds `devices` + `toggle`/
  `setBrightness`/`runScene` (moved out of `HomeSheet.jsx` unchanged),
  called once in `Wall.jsx`, passed as props to both `HomeSheet` and
  `HomeWidget`. Still 100% local `useState`, zero backend — just lifted one
  level so the widget and the full sheet can't disagree within a session.
- **Home ships with no default grid position, deliberately** — tracing the
  actual numbers (`MIN_CELL_SPAN`, `GRID_CONFIG`) found no placement free of
  a real cost: growing `GRID_CONFIG`'s rows (this section's original guess)
  would worsen the whole plan's most-repeated unverified risk (the board's
  minimum-height floor, still unchecked on real hardware); narrowing To-
  Do/Shopping's default width to free a column collides with the overflow
  stopgap noted below (their content still always renders "full" regardless
  of tile size — that's Phase 3's fix, not landed). So the *default*
  household layout is byte-for-byte unchanged by this phase — `defaultLayout()`
  still never places `home`. What's new: `useWidgetGrid.js`'s
  `firstFreeSlot(layout, minSpan, gridConfig)`, a pure reading-order scan for
  the first cell a widget's `minSpan` fits without colliding — this is what
  runs the moment someone actually turns Home on (`Wall.jsx`'s
  `updateHomeSetting`), searching both orientations independently against
  whichever layout source `commitWidgetLayout` would use (device override or
  household default). Verified in the browser both ways: on the shipped
  default layout (fully packed, both orientations) it correctly finds
  nothing and inserts nothing; after freeing a column by hand it correctly
  finds the cell and the widget renders there. If neither orientation has
  room, `settings.home` still flips to `'on'` and Settings' Board Layout page
  shows an honest "No room for it yet" hint (`homeUnplaced` in `Wall.jsx`,
  computed from `resolvedWidgetLayout`) rather than failing silently.
- Turning Home **off** never deletes its placement, only its visibility
  (`WidgetTile`'s `mode`) — same "off hides, doesn't forget" semantics
  To-Do/Shopping already have, verified by toggling off/on in the same
  session and confirming the widget reappeared where it was.
- Small tile: `summaryFor` only ("N of M on"). Large tile: scene row + a
  capped device grid (`groupByRoom`, first 6 devices, "+N more" opening the
  full room). **Size is a `w * h >= 10` threshold on the widget's own grid
  cell span, computed in `Board.tsx` and passed down as a plain `size` prop**
  — not a new generalized measurement hook. `useWidgetSizeTier.ts` (Phase 3,
  below) is for generalizing To-Do/Shopping's existing full/compact
  *setting* into something measured; Home had no legacy setting to preserve,
  so this simpler mechanism was enough and doesn't block Phase 3.
- **Tap toggles a device (same as `HomeTile`'s existing gesture); hold opens
  the full Home sheet, not a dimmer scrim inline on the tile.** A deliberate
  choice, not a shortcut: matches this app's own "Hold a thing to manage it"
  table (hold always reaches *the* management surface for an object, not a
  miniature copy of it), and avoids a second copy of `HomeSheet`'s
  scrim+`Dimmer` markup that would need to stay in sync with the original.
- Extracted `Icon`/`ICON_PATHS` out of `HomeSheet.jsx` into
  `src/components/homeIcons.jsx` so both components render the same SVG
  data — `ICON_PATHS` itself stays module-private (only `Icon` is imported
  elsewhere), which also satisfies oxlint's Fast Refresh rule about a file
  exporting both a component and a non-component binding.
- Reuses the existing `--lit`/`--lit-deep`/`--lit-tint` tokens as-is.
- Stays explicitly a UI shell: only the widget's position/on-off-in-grid
  state syncs via `board_settings.widgetLayout`/`.home` like every other
  widget — device/scene content itself has zero Supabase/RLS/realtime.
- **Settings → Board Layout gets a "Home" row — two chips (On/Off), not
  three.** Home has no Full/Compact *setting* the way To-Do/Shopping do;
  its small/large split above is automatic, not chosen, so a third chip
  would have had nothing to mean. `MainMenu.jsx`'s Home row, previously a
  plain button with a comment explaining it had no board-level setting to
  hold for, now matches Weekly To Do/Shopping exactly (`· hidden on the
  board`, "Hold to change where it shows").
- **This phase also finished Phase 1's own leftover item**: `useViewportClass`
  (built then, never consumed) is now read in `Board.tsx`. A phone-class
  viewport renders a fixed single-column stack (`.board__body-phone-stack`,
  new CSS) instead of `WidgetGrid` — no drag, no resize, no grid coordinates,
  ordered by `WIDGET_ORDER` (now exported from `useWidgetGrid.js` rather than
  module-private). Both containers call the exact same hoisted `renderTile`
  function, so a widget's content can never differ between them. Verified in
  a browser by forcing the branch: all four widgets render in order, the
  stack scrolls (content taller than viewport), and an `'off'` widget is
  correctly absent from the stack too, same as the grid.
- **Real-hardware verification is still outstanding** — everything above was
  checked in a browser (a dev-only `?board-spike` harness extended with a
  "Home: on/off" button exercising the same `firstFreeSlot` logic
  `updateHomeSetting` uses, real auth being unreachable in that session — see
  Phase 0's own note), not on the 11" iPad. The automation environment used
  couldn't be resized below roughly 700×749 regardless of window-resize
  calls, so the phone-stack branch was verified by temporarily forcing
  `viewportClass` rather than a genuine narrow viewport — worth a real
  narrow-window and real-phone check before trusting it further.

### Phase 3 — `ChoresPanel`/`ShoppingPanel` tile-shaping — DONE
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

**What shipped, and two things this phase found that the plan above didn't
anticipate:**
- `useWidgetSizeTier.ts` measures both axes of the tile's own content area
  (not one derived scalar like `useDetailLevel`'s `rowHeight`) — height alone
  decides `full` vs. not (`ENTER_TALL`/`EXIT_TALL` = 360/320px), and below
  that, width decides `compact` vs. `micro` (`ENTER_WIDE`/`EXIT_WIDE` =
  260/230px). First-guess thresholds, same status as this feature's other
  unmeasured constants (`ROW_MIN_PX`, `GRID_CONFIG`) — not yet checked
  against the real 11" iPad.
- **Wiring problem this phase had to solve, not just the hook itself:**
  `Wall.jsx` pre-instantiates `<ChoresPanel mode="full" .../>` as a rendered
  element before `Board.tsx`/`WidgetTile` ever mount, but the measurement can
  only happen on real DOM inside the tile. Solved the same way Calendar
  already does it — `Board.tsx` wraps the child in its own
  `.board__widget-measure` div (the `useWidgetSizeTier` ref target, mirroring
  `.board__week`/`weekRef`) and overrides the already-instantiated element's
  `mode` prop via `cloneElement`, rather than restructuring how `Wall.jsx`
  hands widgets down. `Wall.jsx`'s hardcoded `mode="full"` is gone; `mode`
  defaults to `'full'` inside `ChoresPanel`/`ShoppingPanel` themselves so
  nothing breaks for `PanelSheets.jsx`'s full pages, which still pass it
  explicitly and are otherwise untouched.
- **Pre-existing gap found during this phase, unrelated to sizing but a real
  prerequisite:** `SectionPanel.css`'s base container rules (`.panel-rows`,
  `.panel-list`, `.panel-strip`, `.panel-chip`, `.panel-cart`) were deleted
  wholesale in Phase 1 along with `SectionPanel.tsx` and nothing replaced
  them — `ChoresPanel`/`ShoppingPanel` content had no layout CSS at all on
  this branch, in both the widget tiles and `PanelSheets.jsx`'s full pages
  (`Sheet.css` had two rules assuming these existed). Restored into a new
  `src/components/PanelContent.css`, imported directly by both panel
  components (neither imported a stylesheet of its own before), plus new
  `.panel-micro` rules and chip truncation for the narrower `compact` shapes
  a resizable tile can now have that the old fixed-width dock sidebar never
  needed to handle.
- **Settings surface change, confirmed with Nick before implementing:** the
  Board Layout picker's Full/Compact/Off chips for To-Do/Shopping are gone —
  size is now something you get by dragging the tile, not choosing from
  Settings, so the picker collapsed to on/off only, matching how Home's
  picker already worked (all three sections are symmetric now).
  `board_settings` values are jsonb with no migration; `loadSettings`
  normalizes any pre-existing `'full'`/`'compact'` value to `'on'` on read.
- **Not verified**: real hardware, and the interactive resize/settings check
  itself — both need a signed-in session against the live household account,
  which this pass didn't attempt. `npm run build`/`npm run lint` are clean
  and the app boots with no console errors.

### Phase 4 — `liquid-gooey` polish (only if Phase 0 said go) — STEPS 1–2 DONE
Attempted in this order, each shippable independently, CSS-transition
fallback available at every step:
1. **Drag-lift/settle + invalid-drop snap-back — DONE.** Wraps the dragged
   tile in `effect="move"`; an invalid drop (Phase 1's reject-and-snap-back)
   animates back rather than snapping instantly. Most contained, started
   here as planned.
2. **Resize-handle feedback — DONE, then REVISED.** Originally shipped as
   `effect="bend"` on the actively-dragged resize handle. Real hardware
   feedback (see "Real-hardware findings" below) reframed resize entirely
   before step 3 was ever attempted: it's no longer a drag gesture at all.
   Bend still exists, now only for the brief settle when a picked size
   arrives — see the revised "How steps 1–2 actually work" below.
3. **Widget → full-room morph** (the literal "shared-element" idea, highest
   value and highest risk) — replace `Sheet.jsx`'s flat fade+rise for the
   specific path of opening a widget's full room, morphing the tile's bounds
   into the sheet's. Real, unproven reconciliation between in-grid
   coordinates and the sheet's fixed full-viewport space. Attempt only after
   1–2 ship and read well; keep `Sheet.jsx`'s existing transition as the
   permanent fallback, not a temporary one. **Not started** — steps 1–2 have
   only been smoke-tested (build/lint/dev-server boot, plus the standalone
   `?gooey-spike` demo), not actually seen dragged/resized by a person yet,
   so "ship and read well" isn't satisfied.
4. **Home tile on/off toggle** — thematically the best fit (light "filling"
   the tile) but the most frequently tapped, most exposed surface. Attempt
   last, only if hardware profiling still shows headroom after 1–3. **Not
   started** — no hardware profiling has happened at all (still the same gap
   Phase 0 flagged), so this step's own stated precondition can't be met yet.

**How steps 1–2 actually work, and one thing worth knowing if this needs
revisiting:** the plan above reads as "wrap the tile in Liquid and let it
animate the position" — what got built instead keeps the tile in normal CSS
Grid placement at all times (`gridColumn`/`gridRow` never change for the
gesturing tile) and layers a small, self-contained mechanism on top:

- **Drag**: an additional `transform: translate(x, y)` equal to the gap
  between the raw pointer position and wherever the grid has already
  snapped the tile to. Recomputed every frame, so the discrete grid jump
  and this residual cancel out and the tile visually tracks the finger
  continuously; on release the same transform relaxes to `(0, 0)` via a
  real CSS transition (`var(--dur-move)`/`var(--ease-standard)`), animating
  from whatever was actually last painted — no separate "reject" vs.
  "commit" code path, both just settle to zero from wherever they were.
- **Resize** (revised — see "Real-hardware findings" below): no longer a
  live drag at all. Picking a size from the long-press menu commits
  instantly (`gridColumn`/`gridRow` jump to the new span, like any grid
  change), and only the brief *settle* — the visual footprint easing from
  whatever was last painted to the new committed pixel size — rides on top,
  same CSS-transition mechanism as drag's settle. `effect="bend"` now only
  ever appears during that settle window, never during a live gesture,
  since there isn't one anymore.
- **`<Liquid>`/`<Liquid.Item effect="move"/"bend">` is genuinely mounted**
  around the gesturing tile's content for the gesture's duration (satisfying
  "interaction-triggered only" structurally — every other tile never
  touches the library at all) — but in **`observe` mode, no `x`/`y` passed
  to it**. The actual motion guarantee comes from this app's own
  transform/transition above, not from Liquid's `x`/`y`-driven positioning
  API the spike demo uses. This was a deliberate risk call: this codebase
  has no visibility into `liquid-gooey`'s internals beyond its README's
  prop tables and the one working spike demo, and that demo's own pattern
  (binding a child's rigid `transform` directly to the same un-smoothed
  value passed to `Liquid.Item`'s `x`/`y`) doesn't settle whether the
  library actually smooths rigid content position/size itself, or only
  animates its own decorative blob/goo shape around content the caller is
  already positioning. Driving the real motion independently, with Liquid
  layered on as an observer, is correct either way — if the library does
  more than that, the two mechanisms simply agree; if it does only the
  decorative part, the tile still moves smoothly regardless. Worth revisiting
  with real `liquid-gooey` source access (not just the README) if the visual
  result on real hardware reads as two mechanisms fighting rather than one.
- **`useWidgetResize.js` is deleted** (see "Real-hardware findings" below —
  it existed only to drive the live resize drag, which no longer exists).
  At the time this bullet was first written it hadn't been touched at
  all — Bend's own internal measurement loop supplied velocity straight
  from the live pixel size `WidgetGrid.tsx` was already computing, per its
  README — which is exactly why deleting the hook cleanly didn't touch
  Bend's own usage, only what feeds it. `useWidgetDrag.js` gained one
  addition, unaffected by the revision: `startDrag` now captures the grab
  offset (pointer position minus the tile's own rect, found via the grip's
  nearest `.widget-grid__cell` ancestor) so the tile tracks from where it
  was actually grabbed.
- **`SETTLE_MS` (220ms, matching `--dur-move`) is a JS timeout**, not a DOM
  `transitionend` listener — third-party spring/animation engines aren't
  guaranteed to fire a standard transition event, so a timeout is the
  reliable signal that actually unmounts `<Liquid>` "the instant it ends,"
  per this phase's own non-negotiable rule.
- **Never touches `pointer-events` on anything, ever** — the one thing
  already confirmed (on real hardware, in Phase 1) to silently break touch
  dragging by making WebKit fire a spurious `pointercancel`. Only
  `transform`/`width`/`height` ride on top of the tile's unchanged grid
  placement; no ancestor's `position` or `pointer-events` scheme changes at
  any point during a gesture.
- Also added a small defensive CSS rule (`.widget-grid__cell` is now `flex`
  with its child stretched) since inserting `<Liquid>`'s own wrapper div
  between the grid cell and `WidgetTile` risked breaking `WidgetTile.css`'s
  `height: 100%`, which needs a determinate-height ancestor to resolve
  against and can't assume a third-party wrapper div provides one.

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

### Real-hardware findings and the sizing-model revision

The real 11" iPad, signed in for the first time, immediately surfaced three
things — the first genuine hardware data anywhere in this feature's history:

1. **The bottom edge of the widget grid was clipped, in both orientations.**
   Root cause: `WidgetGrid.tsx` set `.widget-grid`'s `min-height` to fit
   *all* of `GRID_CONFIG`'s nominal rows at `ROW_MIN_PX` each — 16 rows in
   portrait, 10 in landscape — unconditionally, regardless of what was
   actually placed. `.board` wraps everything in `overflow: hidden` with a
   fixed viewport height, so when the real available space (after the
   header and safe-area insets) came in under that blanket reservation, the
   excess was silently clipped. This is the same "reserve the worst case,
   not what's needed" bug class CLAUDE.md already documents once (the
   day-row min-height incident) — recurring here in a new spot, and
   confirming what the plan's own comments had only been able to flag as a
   landscape risk actually hits portrait too.
2. **A blur near the top of the screen** — checked every stylesheet in this
   app for `blur`/`backdrop-filter`: there is none, and `liquid-gooey`'s own
   blur only ever applies mid-gesture, never at rest. Ruled out as
   something Trellis adds; almost certainly iPadOS's own chrome from a
   newer OS version. Nothing changed here.
3. **"This Week" had exactly one mandatory size and could not get smaller.**
   The complaint that reframed the whole resize model: build widget sizing
   like iOS Home Screen widgets — a short, named list of sizes per widget,
   chosen from a menu, not a continuously dragged range.

**The fix for (1) and (3) turned out to be the same change.** `SIZE_PRESETS`
(`useWidgetGrid.js`) replaces the old `MIN_CELL_SPAN` (any span at or above
a floor) with a short list of exact `{w, h}` spans per widget per
orientation — reusing render tiers that already existed: To-Do/Shopping's
ids are literally `ChoresPanel`/`ShoppingPanel`'s own `'micro'|'compact'|
'full'` mode strings (Phase 3), Home's are its existing `'small'|'large'`
size prop values, and Calendar gained a genuinely smaller `'medium'` preset
alongside its old size (now called `'large'`) — the literal fix for
complaint 3. `useWidgetSizeTier.ts` (Phase 3's measured hook) is retired:
which preset is selected is now a direct fact, read via `presetIdFor`, not
something a `ResizeObserver` infers.

Resizing changed from a continuous drag to **long-press the tile → a small
size menu (`WidgetSizeMenu.tsx`) naming the options → tap one to commit**,
independent of "Rearrange widgets" mode (that mode still exists, but only
for repositioning now — see `WidgetTile.tsx`'s own note on why long-press
and the drag grip can't share a gesture while rearranging). An option that
wouldn't fit at the tile's current position is shown disabled rather than
omitted, via a non-destructive `tryResize` check per option — same "the
reason a chip is unavailable is that it goes quiet" pattern
`SettingsSheet.jsx`'s flourish picker already uses. This is what retired
the live resize-drag gesture and `useWidgetResize.js` along with it (see
above).

For (1) specifically: `WidgetGrid.tsx`'s rendered `gridTemplateRows`/
`gridTemplateColumns`/min-height now come from a new `occupiedExtent`
helper — the current layout's actual `Math.max(y + h)` / `Math.max(x + w)`
— instead of `GRID_CONFIG`'s nominal row/column count. `GRID_CONFIG` itself
is untouched and still governs the outer bounds any placement is checked
against; only what gets *rendered* changed.

**One important thing this does NOT yet fix, worth being explicit about:**
every widget's largest preset was deliberately set to reproduce its old
default placement exactly (see `SIZE_PRESETS`'s own comment — "this changes
what sizes exist, not what a household already looking at the board sees
today"), and `defaultLayout` still places everything at its largest preset
by default. Working the actual numbers: portrait's default arrangement
occupies rows 0–11 (Calendar) and 11–16 (To-Do/Shopping) = 16 rows total,
exactly `GRID_CONFIG.portrait.rows`; landscape's is 0–10 (Calendar) and
0–10 (dock, split across columns) = 10 rows, exactly
`GRID_CONFIG.landscape.rows`. **`occupiedExtent` only reduces the reserved
height below `GRID_CONFIG`'s nominal count when something is actually
smaller than that count — a household that hasn't turned anything off or
resized anything down (i.e., anyone still on the stock default layout)
gets zero benefit from this fix on its own.** It only becomes real for a
default household once a widget is turned off, or once someone actually
picks a smaller preset for something.

Concretely, this means the clipping this session actually saw may well
still reproduce on an untouched default board. **The next real-hardware
test that actually settles this**: on the iPad, long-press "This Week" and
pick Medium. If the clipping goes away, `SIZE_PRESETS`'s numbers are
basically right and the fix is complete as shipped. If it's still clipped
even at Medium, `ROW_MIN_PX`/`GRID_CONFIG`'s base numbers are themselves
miscalibrated against the real device's real available height — a
different, more fundamental fix than anything presets can offer, and
independent of whether any particular widget is big or small. Whichever
way that test comes back is the actual, final piece of real-hardware data
this feature needs before this can be called done — every number here is
still first-guess otherwise.

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
`useWidgetDrag.js`, `useViewportClass.js`;
`src/components/WidgetGrid.tsx`+`.css`, `WidgetTile.tsx`+`.css`;
`src/lib/widgetLayout.js`; `src/dev/gooey-spike.jsx`, `src/dev/board-spike.jsx`
(both throwaway dev harnesses, query-param gated, lazy-loaded).
`useWidgetResize.js` also shipped here but is now deleted — see the sizing-
model revision below.

**New (Phase 2, shipped):** `src/hooks/useMockHomeState.js`;
`src/components/HomeWidget.jsx`+`.css`, `homeIcons.jsx`. Added a
`firstFreeSlot` export (and exported the previously module-private
`WIDGET_ORDER`) to the existing `useWidgetGrid.js` rather than a new file.

**New (Phase 3, shipped):** `src/components/PanelContent.css` (not in the
original file list — restores `SectionPanel.css`'s deleted base panel-
content rules, a prerequisite this phase found rather than planned for; see
Phase 3's own notes above). `useWidgetSizeTier.ts` also shipped here but is
now deleted — see below.

**New (Phase 4 steps 1–2, shipped):** `src/hooks/usePrefersReducedMotion.js`
(promoted from the one-off copy already in `gooey-spike.jsx`). Added a
`cellToPixel` export (the inverse of the existing `pixelDeltaToCellDelta`) to
`useWidgetGrid.js` rather than a new file.

**New (the sizing-model revision, shipped, driven by real-hardware
feedback — see that section above):** `src/components/WidgetSizeMenu.tsx`
+`.css` (the long-press size picker). Added `SIZE_PRESETS`, `presetsFor`,
`minSpanFor`, `defaultPresetFor`, `presetIdFor`, and `occupiedExtent` to
`useWidgetGrid.js`, replacing `MIN_CELL_SPAN`.

**Deleted (the sizing-model revision):** `src/hooks/useWidgetResize.js`
(the live resize-drag gesture it drove no longer exists — resize is a
picked preset, not a drag, and Bend's velocity-measurement loop now only
ever sees the settle animation, not a live gesture), `src/hooks/
useWidgetSizeTier.ts` (Phase 3's measured-tier hook — which preset is
selected is a direct fact now, read via `presetIdFor`, not something
inferred from a `ResizeObserver`).

**New (Phase 4 steps 3–5, not yet built):** `useWidgetGrid.test.js`.

**Substantially rewritten (done):** `Board.tsx` (`.board__body` →
`<WidgetGrid>`, header untouched; Phase 2 added the `home` renderTile
branch, hoisted `renderTile` to a plain function, and added the
`useViewportClass`-gated phone-stack branch), `SectionPanel.tsx`/`.css`
(deleted, replaced by `WidgetTile`), `Wall.jsx` (new `widgetLayout` state
extending `DEFAULT_SETTINGS`, new props into `Board`; Phase 2 added
`homeState`/`updateHomeSetting`/`homeUnplaced`), `MainMenu.jsx` ("Rearrange
widgets" row from Phase 1; Phase 2 made the Home row a full `MenuRow`; the
sizing-model revision reworded its meta text now that the mode only moves
widgets, not resizes them), `HomeSheet.jsx` (Phase 2: device state hoisted
out to `useMockHomeState`, `Icon` imported from the new `homeIcons.jsx`
instead of defined locally), `SettingsSheet.jsx` (Phase 2: Home on/off row
+ "no room yet" hint in `BoardLayoutCategory`; Phase 3: collapsed
`BoardLayoutCategory`'s three sections to one shared on/off chip row,
removing the Full/Compact choice — see Phase 3's notes above),
`ChoresPanel.jsx`/`ShoppingPanel.jsx` (Phase 3: new `'micro'` render +
loading-skeleton branches, default `mode = 'full'`, import the new
`PanelContent.css` — untouched by the sizing-model revision beyond that,
since their preset ids already are their mode strings), `WidgetGrid.tsx`/
`.css` (Phase 4: the drag-settle mechanism described in Phase 4's own notes
above; the sizing-model revision removed the live resize-drag path
entirely, added `occupiedExtent`-based grid sizing and the size-menu
state/wiring), `WidgetTile.tsx`/`.css` (the sizing-model revision: removed
the resize grip, added `useLongPress` wiring for the size menu on both head
variants — including the plain, no-`onOpen` head Calendar uses, which
didn't exist as a gesture target before), `useWidgetDrag.js` (Phase 4:
`startDrag` now captures a grab offset).

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
