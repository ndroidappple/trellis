# Trellis (wall-planner)

A shared household wall calendar for two people (Nick + Ed), meant to run
full-screen on an iPad mounted on a wall — plus each person's phone for
quick checks. Vite + React (JS, with a few TypeScript files in the design
system) + Supabase (Postgres, auth, realtime).

Repo: `github.com/ndroidappple/trellis`, local checkout at
`~/Documents/wall-planner`.

## Commands

- `npm run dev` — dev server at http://localhost:5173/
- `npm run build` — production build (also the fastest way to catch
  compile errors across the mixed .jsx/.tsx codebase — there's no
  standalone typecheck script)

  **Builds require credentials, on purpose.** `vite.config.js` aborts a
  build when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing
  (from `.env.local` or the environment). Don't remove that guard.

  The failure it prevents is nasty: `src/lib/supabase.js` throws at module
  scope without those vars, Vite inlines `import.meta.env` at build time, so
  the throw becomes unconditional and Rolldown proves everything downstream
  unreachable and tree-shakes the whole app away — exiting 0, reporting all
  modules transformed, emitting full CSS, and shipping a blank screen. The
  only tell was bundle size: ~430 kB with the app, ~199 kB without.

  A `git worktree` does not inherit `.env.local` (it's gitignored), so copy
  it in before building there. `npm run dev` deliberately still runs without
  credentials — it fails visibly in the browser and can't be deployed.
- `npm run lint` — oxlint

## Architecture

- `src/App.jsx` — auth gate (8-digit emailed code, see "Authentication")
  → `Wall`
- `src/components/Wall.jsx` — the orchestrator. Owns all Supabase
  fetching/mutation (events, chores, shopping list, meal plan) and feeds
  it into the presentational `Board` component. Also defines the
  `EventEditor`, `MealEditor`, and `SettingsPanel` dialogs inline.
- `src/components/Board.tsx` + `WeekGrid.tsx`, `EventChip.tsx`,
  `PersonBadge.tsx`, `ChecklistRow.tsx`, `SectionPanel.tsx` — the visual
  design system (see "UI redesign" below). Mostly TypeScript, transpiled
  by esbuild with no `tsconfig.json` (no type-checking, just syntax
  stripping — keep in mind type errors won't be caught, only syntax ones).
- `src/components/ChoresPanel.jsx`, `ShoppingPanel.jsx`, `AddRow.jsx` —
  assemble live data into the shapes `SectionPanel.css` already has rules
  for (`panel-rows`, `panel-list`, `panel-strip`, `panel-cart`). Each panel
  component takes a `mode: 'full' | 'compact'` prop; `Wall.jsx` renders
  both variants since `Board` needs them simultaneously.

  **The capture field folds away behind a button in the dock** (`AddRow`'s
  `collapsible`). Its *placement* is unchanged and still deliberate — outside
  the scrolling list, so capture never means scrolling to the bottom of a full
  panel — but standing permanently open it drew a hard input rectangle across
  the base of a surface otherwise made of paper rows and hairlines. It costs
  one tap before typing, paid back by staying open after a submit, so it is one
  tap per visit rather than per item. The full pages pass `collapsible={false}`:
  a page has the room, and going to one is already a statement of intent.

  Both panels group their contents rather than presenting a flat list —
  chores by Today / This week / As needed (`groupChores`), shopping by aisle
  (`groupByAisle`). The add row sits *outside* the scrolling list in both, so
  capture does not require scrolling to the bottom of a full panel.
- `src/components/PanelSheets.jsx` — `ToDoSheet` and `ShoppingSheet`, the
  full-page versions of the two dock sections, opened by tapping a panel's
  head. They reuse the panel components rather than reimplementing them, so
  the page and the dock cannot drift about what is on the list. The page is
  also where the things the dock deliberately omits live: per-row delete,
  "clear ticked", and the named list of unpriced ingredients behind the cart
  footer's count.
- `src/lib/shopping.js` — aisle vocabulary, walking order, and grouping.
  The vocabulary is `recipe_ingredients.ingredient_category` verbatim, since
  a grocery line inherits its aisle from the ingredient it came from.
- `src/lib/supabase.js` — client, reads `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` from `.env.local` (gitignored via the `*.local`
  rule).
- `src/components/MainMenu.jsx` — the board's front door, opened by the
  header's `Menu` button. A dialog, not a sheet: six rows, and the board
  showing through behind them is the point. Holds the recipe book, both dock
  pages, settings, and — when today has a meal with a method — a one-tap row
  straight into cook mode, which prefers a half-finished recipe ("Back to step
  4") over a merely planned one.

  It exists because the header used to carry a lone `Recipes` button among the
  week arrows, and because **switching a dock section to Off removed the only
  route to its full page** — the panel head is the door, and `SectionPanel`
  returns null at Off. A layout preference was taking away per-row delete,
  "clear ticked" and the unpriced-ingredient list. The menu names each section
  even when its panel is hidden.
- `src/components/Screensaver.jsx` + `src/hooks/useIdle.js` +
  `src/lib/screensaver.js` — Feature #5, first version. See "Ambient screen
  timeout" below.
- `src/lib/meals.js` — meal slots. See "Meal slots" below.
- `src/lib/cookProgress.js` — where you had got to in a recipe, in
  `localStorage`, expiring after 6 hours. Per-device rather than per-household
  on purpose: a cook in progress is a fact about *this screen right now*, and
  syncing it would have the wall and a phone snatch each other's place
  mid-recipe.
- `src/lib/week.js` — date helpers, Sunday-start week, no date library.
- `src/lib/cost.js` — weekly grocery cost projection from the meal plan
  (leftover nights are free; shared ingredients across recipes are
  deduped to whole packages before pricing), plus `recipeCost` for one
  recipe on its own. See "Price per serving" below: the two answer
  different questions and deliberately do not sum to each other.
- `src/tokens.css` — design tokens (colors, type, sizing). Real Fraunces
  (display serif) + Figtree (text sans) fonts are installed via
  `@fontsource-variable/fraunces` / `@fontsource/figtree`, imported in
  `main.jsx`.
- `src/components/RecipeBook.jsx` — the recipe book, in three layers:
  `RecipeBook` (the shelf: search over titles *and* ingredient names, four
  filters, and the `$` price toggle), `RecipeDetail` (one recipe, plus "plan a night" against the week
  currently on the board), and `CookMode` (one step at a time at 40px, holding
  a screen wake lock). **Tapping the step moves through it — the left 30%
  (`BACK_ZONE`) goes back, the rest goes on.** The footer buttons are 52px in a
  corner and your hands are covered in raw chicken, so the reading area is the
  target you can actually hit; going back used to have only the corner button,
  which made the one move you make when you have missed something the one move
  that required clean hands.

  Nothing marks the boundary at rest — this screen is one 40px sentence read
  from across a kitchen, and a permanent divider down it would be furniture in
  the middle of the only thing worth looking at. The press does the teaching:
  `data-press` lights that zone and draws a hard edge at 30%, which is both the
  acknowledgement and the lesson. **If `BACK_ZONE` changes, the four
  percentages in `.cook__body[data-press=…]` change with it**, or the highlight
  draws an edge somewhere other than where the tap is judged.

  It rejects a tap that travelled more than `TAP_SLOP_PX` (the step text
  scrolls, and a scroll is not a tap) — which doubles as the escape hatch: see
  the wrong side light up, slide 12px, nothing fires. It ignores taps starting
  on a control, never advances off the last step ("Finish" exits, not something
  a stray touch should do mid-recipe) and never goes back off the first. Zones
  are judged from where the finger **landed**, not where it lifted.

  `onExit(finished)` distinguishes the Finish button from the header's Done:
  finishing clears the remembered step, stepping out keeps it, which is what
  makes the menu able to offer "Back to step 4".

  Reached from the `Menu` button in the board header, from a day view that
  already has a meal on it (which offers cook mode *directly* now, not via the
  recipe), or from the menu's cook row. `Wall.jsx` fetches the whole
  bank in one lazy query (`RECIPE_BOOK_QUERY`) the first time the book opens —
  18 recipes / 127 ingredients / 56 steps is small enough that this beats a
  round trip per recipe, and the detail view then opens with no spinner.
  **`MealEditor`'s picker is this same component**, passed `title`, `lead`
  (the slot chips) and `highlightId`. It used to be a separate, much poorer
  list — plain titles, title-only search, no artwork, no filters — which was
  never a design decision. The picker was built first against the thin
  boot-time `recipes` query and could not have rendered a filter row if it
  wanted to, because it had never loaded the columns the filters read. Two
  differences remain and both are real: retired recipes are excluded when
  picking, and tapping plans in one tap rather than opening (see `pickMeal`).
  Opening the editor now preloads the book — see the effect above `openBook`.
- `src/components/MealsCard.jsx` — **unmounted, unused.** Pre-redesign
  meal-planning UI (whole-week panel + recipe picker). Kept as reference;
  `Wall.jsx`'s `MealEditor` is the current per-day equivalent.

## Database (Supabase)

Two-person household model — see `handle_new_user()` in
`001_initial_schema.sql` for the signup allowlist (edit the two emails
there if this ever needs a third person or different people).

RLS is the real security boundary: every table's policies funnel through
`current_household_id()`, which resolves via the caller's `profiles` row.
No profile row = no access, even with a valid session.

`013_shopping_aisles.sql` gave `list_items` a `category` and a `qty`, and
`staples` a `category`. Quantity used to live inside the item's text as a
"×2" suffix, which made the label the source of truth for a number — so
"Ground turkey" and "Ground turkey ×2" were different items to the text-match
dedupe in `pendingGroceries`, and a heavier week added a second row instead
of a bigger number. 013 parses the suffix out of the 11 rows that carried it.

`supabase/migrations/` now holds the complete set, `001`–`007`. 004–006
had been run straight against the live project and existed nowhere in git
for a while; they were recovered and committed in slice 9, so the schema is
reconstructible from this repo again.

**Re-running `006_seed_meal_hq.sql` is destructive.** It is idempotent by
wiping first, and its `delete from products` / `delete from staples` are
not scoped to `source = 'meal_hq'` — so anything added by hand since is
gone, and `weekly_budget_cents` is reset to 12000. Fine for rebuilding a
fresh project, not something to run casually against the live one.

004–006 seed no `meal_plan` rows, which is correct: meal plans are user
data written through the app, not seed data. A rebuilt project starts with
the price book and recipe bank but an empty week.

`015_ingredient_purchase_quantities.sql` fills the four ingredient rows that
carried a product but no `purchase_qty`, using the conventions the bank had
already settled on (1 whole onion = 0.17 of a 3 lb bag; 2 cups dry rice = 0.17
of an 80 oz bag). Those rows were missing from the cost projection, the
shopping list *and* the book's price at once — `weekPackages` needs both halves
and drops a row missing either. One row is deliberately still null: the
smoothie's frozen berries, unit "fill cup", which needs a person.

Tables: `household` (singleton row — budget, `board_settings`),
`profiles`, `events`, `chores`, `list_items` (shopping/todo, though todo
isn't currently surfaced in the UI — see below), `recipes`,
`recipe_ingredients`, `recipe_steps`, `products`, `staples`, `meal_plan`.

## UI redesign (the "Board" system)

The app went through a full visual redesign partway through — the original
dock-based layout (`.wall`, `.dock`, `.dock-card`) was replaced with the
"Board" design system (density-aware week grid, `tokens.css`, Fraunces
serif). This was a genuine rewrite of the presentation layer, not just a
reskin — `Wall.jsx` was rebuilt to feed real data into the new components.

**Deliberately dropped / not carried over from the pre-redesign app:**
- **To-do list** — the old app had a second `list_items` list (`kind:
  'todo'`, separate from shopping). The Board design only has dock slots
  for two sections; "Chores" was relabeled "To-Do" rather than adding a
  third slot, so the old standalone to-do list has no UI anymore. The data
  model (`list_items` with `list='todo'`) still exists and still works —
  it's just not queried or rendered by anything currently.
- **Chore reassignment by tapping the assignee badge** — `ChecklistRow`
  (from the design bundle) doesn't expose a second tap zone for this: the
  whole row's click toggles done/not-done. The badge shows who's assigned,
  but you can't tap it to cycle to someone else anymore. `assignee_id` is
  null on every chore and probably always will be: this household alternates
  chores rather than assigning them, which is what `rotates` is for (below).
  On a done chore the badge now shows who actually *did* it, from the
  completion log, rather than who it was assigned to.
- **Landscape iPad orientation** — row/panel minimum heights (see below)
  are tuned for portrait (1024×1366pt, the "12.9" iPad in portrait" this
  was built for per the original design comments). In landscape the dock
  panels will get tight or clipped. Not addressed yet.

**Settings:** `Menu → Settings`, or long-press the board (~650ms). Also holds
**Sleep now**, which drops straight into the ambient scene without waiting out
the timeout; waking stays "any touch", exactly as a timed sleep does, so there
is only ever one thing to know about getting the board back.

**Screen timeout is one row, not two.** `lib/screensaver.js` implements the
household-default-plus-device-override model Feature #5 §8 asks for, and
`timeoutMsFor` still honours a device pin — but only one control is surfaced,
because a setting whose entire purpose is to describe a difference between
devices should not appear before a second device does. Picking a value clears
any device pin in the same action, so the visible control is always the one
telling the truth. Split it back in two when the household has two screens. The
long-press still works and is still undocumented in the UI; it stopped being
the *only* way in when the menu arrived, which mattered because the dialog is
where you undo switching a section off, and switching a section off used to
hide its page. The dialog sets each
section (To-Do, Shopping) to Full / Compact / Off. Persisted on
`household.board_settings` (jsonb), synced via Supabase realtime so the
wall and a phone agree. `SectionDock` computes 1 vs. 2 columns from
whichever modes are active.

The press tolerates 12px of drift (`LONG_PRESS_SLOP_PX`) and ignores
presses that start on a control. Cancelling on any pointermove at all made
this nearly impossible to open with a fingertip — a finger resting on
glass emits a constant dribble of move events, while a held-still mouse
emits none, so it tested fine on a Mac and failed on the wall.

**Run it from the Home Screen, not from Safari.** Every browser on iPadOS
uses WebKit and keeps its own toolbar, so no browser choice gets the full
screen — the page declares itself a web app instead
(`apple-mobile-web-app-capable`), and Add to Home Screen then launches it
with no browser UI. `apple-mobile-web-app-status-bar-style` is
`black-translucent`, so the page runs *behind* the status bar and `.board`
adds `env(safe-area-inset-*)` to its padding to stay clear of the clock and
battery. Those insets resolve to 0px in a normal tab, so the desktop layout
is unchanged. This matters beyond looks: every `useDetailLevel` threshold
is calibrated against the full-height viewport.

## Wall survival

The iPad runs unattended for weeks, which breaks assumptions that hold
fine in a browser tab you close every evening:

- **The clock is a data source.** `useToday` re-renders at each local
  midnight (timer recomputed from a fresh `Date`, so DST days are 23h/25h
  rather than a drifting 24h) *and* on `visibilitychange`, because a
  sleeping iPad suspends timers. Anything date-derived — `isToday`, the
  weekly-chore reset in `choreIsDone`, the `anchor` week — hangs off it.
  Never call `new Date()` during render to decide what day it is.
  The anchor follows midnight only if the board was already on the current
  week, so paging forward on a phone isn't undone underneath you.
- **Say the truth about staleness.** `useRealtimeTable` reports each
  channel's real subscription state; `combineStatus` says "Live" only when
  all five are up, otherwise "Connecting…" or "Offline · <last fetch>",
  with the header dot colored to match. It used to be a hardcoded "Live",
  which is worse than useless on a wall — a green dot over a stale week.
  Waking or regaining network refetches everything outright rather than
  trying to reason about whether the socket survived.
- **A crash must not be a blank rectangle.** `ErrorBoundary` (wrapping
  `App` in `main.jsx`) shows the error text — there are no devtools on a
  wall — and self-reloads once, rate-limited to one auto-reload per 10
  minutes via `localStorage` so a persistent crash settles onto the error
  screen instead of flashing the wall forever.

**Known layout-bug class, already fixed once, worth remembering:** flex
rows/panels in this design need explicit `min-height` floors. Without one,
a short viewport doesn't degrade gracefully — content just gets silently
clipped by `overflow: hidden` with no visual sign anything's missing (this
happened to the day rows: buttons cut in half, today's weekday label
invisible, on a Mac browser window shorter than the iPad this was tuned
for). If you add new flex children to `Board`/`WeekGrid`/`SectionPanel`,
give them a real computed minimum, not `min-height: 0`.

## Ambient screen timeout (Feature #5, first version)

After a configurable idle period the board fades into a slow ambient scene.
This is the state the iPad is in for most of its life, which inverts the usual
priority: the "idle" screen is really the primary visual surface.

It is not decoration. **Slow movement is a functional requirement.** The week
rules, panel edges and header are static geometry in fixed positions for weeks
— the exact condition that burns a display — so every layer in the scene
travels. The second job is light pollution: an always-lit screen in a room
people relax in is a lamp nobody asked for, hence the much darker, slower night
variant (22:00–06:00, `NIGHT_FROM_HOUR` / `NIGHT_TO_HOUR`).

- **The day scene is dark, and used to be beige.** `--ground` was `#DCDCD0`,
  a shade off the board's own paper. It photographed well and defeated the
  point: a screensaver as bright as the screen it replaces saves no light at
  all. Day is now `#14150F` with the trellis picked out on it — which is the
  value the reduced-motion fallback had been using for the day scene all
  along — and night drops to `#0B0C08`.
- **The canvas band under the home indicator takes `body` as well as `html`.**
  `index.css` sets `html, body { background: var(--plaster) }`, so the
  screensaver naming only `html[data-saver=…]` left `body` painted
  board-beige and a strip that did not match the scene above it. Both are set
  now, so they cannot drift apart.
- **The scene was rebuilt to stop looking drawn and start looking grown.**
  Same four objects — lattice, vines, leaves, clock — but:
  - **Vines are filled outlines, not strokes.** A stroke is one width for its
    whole length, which is why they read as wire. Two edges walked at
    `±stemHalfWidth(t)` off the centreline close into a shape that is heavy at
    the soil and hair-fine at the tip.
  - **The curve is a sine plus a second harmonic, with amplitude that grows
    with height and a squared lateral drift.** One sine has exactly one
    gesture in it; a stem is held firm at the root and waves more freely the
    higher it gets.
  - **Leaves are two cubics from base to point**, not ellipses — rounded where
    they meet the stem, drawn out to a tip — sized larger low on the plant,
    with a deterministic angle jitter so they are not all stamped at the same
    lean. 17 a vine.
  - **The lattice is two groups at two weights**, plus per-line opacity
    variation. Not a true weave, but what a weave reads as from across a room.
  - **Gradients in `objectBoundingBox` units**, so one `<linearGradient>`
    definition orients itself to each of 102 leaves' own boxes.

- **Growth is a `clip-path: inset()` on the plant group, and that killed a
  whole bug class.** Each `<g class="saver__plant">` holds a stem *and its own
  leaves*; `inset(100% 0 0 0)` is a zero-height window at the bottom of the
  group's box, and winding the top inset to 0 raises it. So one edge reveals
  stem and foliage together.

  This replaced `stroke-dashoffset` plus a per-leaf `--at` delay that had to
  survive the climb easing, the path-length-versus-parameter difference and
  the per-vine `-9s` stagger — three separate bugs lived in that arithmetic,
  all of which are now unrepresentable. It also removed 78 animations (92 → 33
  on an always-on device), and the clip edge crossing a leaf makes it unroll
  from its base rather than switch on.

  Two things to know: if a browser lacks `clip-path` the declaration is
  dropped and the plant renders whole and unanimated — a scene that stopped
  growing, not one that is missing. And **the pause rule must name
  `.saver__plant`**; it named `.saver__vine`, which no longer animates, so
  `data-paused` silently stopped pausing anything.

- **Leaf attachment is now structural.** The base sits at `0.55 ×` the stem's
  half-width off the centreline — *inside* the stem — and the leaf grows
  outward from there. `isPointInFill` says all 102 bases are within the stem's
  filled shape. The old version centred an ellipse beside the stem and hoped
  the overlap held, which is what made three separate placement bugs possible.
  Historical note worth keeping: one of those was `transform-box: fill-box` +
  `transform-origin: center` composing a second origin onto SVG's
  `rotate(deg cx cy)`, turning a rotation into a translation — a leaf computed
  for (50, 591) rendered at (-235, 693). **Verify against rendered geometry,
  not attributes**: the first check read `cx`/`cy` and pronounced everything
  perfect while the screen plainly disagreed.

- **There is text now: the time, and it stays centred.** The original rule was
  no text at all, because text sits in fixed pixels. The first answer moved
  the clock each minute, which was the wrong shape for the problem — a
  discrete jump is the one kind of movement the eye cannot miss, so it read as
  unplaced rather than protected. Centred now, drifting ±1.7vmin over 397s,
  share-prime with the 247s growth and 331s drift: no glance resolves it as
  motion and no digit holds a pixel. **The drift loop must average exactly
  zero.** The first one used three hand-picked waypoints that averaged about
  +0.45vmin right and down, so the clock spent most of every cycle below and
  right of centre — which is not drifting, it is being off-centre slowly. Four
  points at ±A in quarter-turns make a diamond whose every quarter cancels the
  one opposite, so the mean is zero by construction. Measured: 0.00px on both
  axes over 200 samples. Also **`margin-top: env(safe-area-inset-bottom) / 2`**
  — `.saver` is `fixed; inset: 0`, which stops short of the home-indicator
  strip (the same fact that forces the root-element background above), so
  anything centred in the overlay sits half that strip too high on the actual
  wall. That line is inert off-device and is the one piece of the clock's
  placement that cannot be checked from a desktop browser. Under `prefers-reduced-motion` the drift
  stops and it dims instead, being then the only lit thing on the panel. **The glyphs win on
  contrast, not by clearing space behind them**, and that took three goes. A
  radial wash on the element's box erased about a third of the width of the
  wall (that box is ~1000×330 at this font size) and read as a black
  rectangle. Wide stacked text shadows were the same defect smaller — any
  ground-coloured halo broad enough to hide a vine also hides the lattice, and
  neighbouring glyphs' halos merge into a boxy blob. The actual fault was that
  `--clock` at 34% white sat *behind* `--stem` at 46% green: the wrong thing
  was brighter, and no shadow fixes that. The clock is now brighter than the
  stems, with a 3px shadow doing nothing but holding an edge where a vine
  crosses a stroke. Nothing is erased, so the centre stays lit like everywhere
  else — which matters for the same reason the scene moves at all: a
  permanently unlit patch is its own kind of static image. `useClockMinute`
  re-reads on `visibilitychange`: an iPad back from suspend would otherwise
  light up showing a time from some minutes ago.
- **"Sleep now" used to last about fifteen seconds.** The button is a tap,
  the tap runs `markActive` on its way past, so `lastActivity` said somebody
  was here — and the next tick dutifully answered "not idle" and switched the
  scene off with nobody having touched anything. `useIdle` now carries a
  `forced` flag that the tick respects and any real activity clears. A flag
  rather than backdating `lastActivity` by the timeout, because that has no
  answer for a household set to "Never" — where there is no timeout to
  subtract and sending the wall to sleep by hand arguably matters most.

- **The idle timer is never a long `setTimeout`.** Timers do not survive an
  iPad suspending — a ten-minute timer set at 21:50 on a device that sleeps at
  21:52 fires whenever the hardware feels like it. `useIdle` stores a
  last-activity timestamp and compares it against a fresh `Date.now()` on a 15s
  tick, the same shape as the midnight rollover in `useToday`. A late tick
  costs nothing; it reads the real clock and gets the right answer anyway.
- **A wake is a fresh start, not a resumed countdown.** Coming back to a board
  that fades out four seconds later reads as a fault.
- **The board stays mounted.** The scene is a sibling overlay at `z-index: 40`,
  rendered last in `Wall`. Unmounting the board would tear down five realtime
  channels and the clock hook, and the wall would return showing a stale week.
- **The gate is `syncState !== 'offline'`, not `=== 'live'`.** It was the
  latter, and that was a bug rather than caution: `combineStatus` only says
  "live" when **all six** realtime channels are up and returns "connecting" if
  one is mid-handshake — routine on a device that sleeps. So a single flaky
  channel meant the wall never faded at all, and it failed silently, because
  nothing on screen connects "the dot is grey" to "the screensaver is off".
  Connecting is not disconnected; only offline is.
- **Three things suspend it entirely** (`screensaverAllowed`): cook mode, which
  holds a wake lock and exists to keep showing you a step while your hands are
  full; anything but a live connection; and an error on screen. The last two
  are the same argument — a beautiful animation over a board that stopped
  updating four hours ago is the "green dot over a stale week" failure in a
  prettier costume.
- **The waking touch is swallowed.** Same bug class as the long-press: one
  touch meaning something to the wall and something else to the widget under
  it. The pointerdown is `preventDefault`ed and the following click is caught
  capture-phase at the window and released on a 700ms timer, since a swipe or a
  cancelled touch ends in no click at all. Verified: zero clicks leak through.
- **Timeout is the one board setting that is wrong at household scope.** Every
  other setting describes the board, so the wall and a phone agreeing is the
  point; this one describes a *device*. Household default lives in
  `board_settings.screensaverMin` — jsonb, so **no migration was needed** — and
  any device may pin its own in `localStorage`. `null` there means "follow the
  household", which is deliberately distinct from `'never'`: a device that
  chose never must not start fading again because someone changed the default
  from a phone.
- **`prefers-reduced-motion` removes the bright shapes rather than freezing
  them.** The brief asked for "a still or near-still variant", which taken
  literally is a contradiction — a still highlight parked on the same pixels
  for hours is the image retention this feature exists to prevent. What remains
  is a flat, very dark field. The arrival keeps a short fade; an opacity change
  is not travel, and a hard cut still reads as a fault.
- **The scene is a trellis, growing.** A lattice fades up, six vines climb it
  over ~4 minutes, leaves open behind each growing tip, then everything recedes
  and begins again slightly elsewhere. The first version was four drifting
  fields of coloured light — calm, and anonymous enough to belong to any app.
  **The geometry is generated, not hand-listed**, so a leaf and the path point
  it sits on come from the same function and cannot drift apart.
- **A trellis is the harder shape to do safely**, and that governs it: straight
  lines in fixed positions are exactly what burns a panel. Three things pay for
  it — growth means most pixels are dark most of the cycle, nothing survives a
  cycle (everything fades out and redraws), and the composition drifts on a
  period share-prime with the growth.
- **Periods are mutually prime** (247s cycle / 331s drift). On round
  durations four layers resynchronise every couple of minutes into a figure the
  eye learns and anticipates; on primes the combination does not repeat for
  over eleven days.
- **Paused when the document is hidden**, explicitly. Browsers throttle
  offscreen animation but do not reliably stop it, and pausing also makes the
  return seamless — the timeline resumes rather than snapping.

**The canvas has to be painted, not just the overlay.** `viewport-fit=cover`
lets the page reach the physical edges, but the strip behind the home indicator
is *outside* the initial containing block, so a `position: fixed; inset: 0`
overlay never covers it. Only a background on the root propagates there —
without one the board faded to the scene and left a band of iOS wallpaper along
the bottom of the Home Screen web app. `index.css` sets the board's default and
`Screensaver` stamps `data-saver` on the root so the band follows the scene
into night.

**Not yet verified on the actual wall**, which is the only open item on the
feature's Definition of Done and cannot be closed from a browser. It also
requires **Settings → Display & Brightness → Auto-Lock → Never** on the iPad,
or iPadOS blanks the screen first and none of this is ever seen.

## Meal slots

`meal_plan.slot` has accepted `breakfast | lunch | dinner | snack` since
`004_recipes.sql`, with `unique (household_id, on_date, slot)`. The app only
ever wrote `'dinner'`, on the reasoning still recorded in `MealsCard.jsx`:
"v1 plans dinners only. Breakfast and lunch are standing routines in this
household." All four are now reachable. **No migration — the schema was
already right; three hardcoded call sites were not.**

- **Dinner keeps every advantage.** `nextFreeSlot` pre-selects it, `bySlot`
  sorts chronologically (the order of a *day*, not of importance — a list that
  put dinner first because dinner matters most would be unreadable), and
  planning one costs no more taps than before.
- **"+ Meal" was not a rename.** Relabelling alone would have promised four
  slots and still written one, and `mealEntryFor`'s `slot === 'dinner'` filter
  would have made every other slot invisible on the board. The label could only
  tell the truth once the reads and writes did.
- **`mealMeta` replaced "Cooking tonight"**, which was wrong about the meal the
  moment there was more than one and had *already* been wrong about the day — a
  dinner five days out said "tonight".
- **A taken slot stays pickable in the editor, marked with a `·`.** Switching
  to it is how you change that meal, so refusing would be wrong; but the unique
  constraint means picking a recipe there *replaces* what is on it, and a
  control that silently overwrites is worse than one that says so.
- **`nextFreeSlot` returns null once a day is full**, which hides the add
  button rather than offering a tap that would upsert over an existing meal.
- **`RecipeDetail`'s "Plan a night" still means dinner specifically**, which
  suits a footer that asks "Which night?" and offers seven days. If slots turn
  out to get used, that footer is the next thing to revisit.

## Who did the chore

**The wall cannot tell who tapped, so every completion it records is an
inference.** 012 solved this for episodic chores by asking outright — a button
per person, attribution and completion in one tap — but a checkbox has no room
to ask, so weekly and one-off chores went on crediting `profile.id`, the
session owner. On a shared wall that is wrong roughly half the time *by
construction*, and it was quietly poisoning the log that Feature #6 is built
on.

Two changes, and deliberately neither is "ask on every tick" — the tick is the
fast path, and a wall people touch in passing should not interrogate them:

- **A rotating chore credits whoever is up.** `toggleChore` uses the same
  `nextTurn` the row already displays. Still an inference, but the household's
  own alternation rather than an accident of which account is signed in.
- **Any guess is one tap from correct.** `cycleChoreCredit` hands the credit to
  the next person, reached by **tapping the badge on a completed row**.

`ChecklistRow`'s root is therefore a `<div>`, not a `<button>`. It was a
button with the badge rendered inside it, which made the badge un-tappable by
construction — a button inside a button is invalid, and the click belonged to
the row — so the one piece of information most likely to be wrong was the one
piece you could not correct: tapping "N" to say it was actually Ed just
un-ticked the chore. The toggle is now its own button filling everything up to
the badge, so the big easy target is unchanged.

The badge is only a control where there is a credit to correct; an unticked
chore has nobody on it. Shopping passes no person and is unaffected.
`cycleChoreCredit` upserts on `(chore_id, on_date)` — correcting a credit is an
update to an existing completion, not a second one — and leaves `completed_at`
alone, because somebody fixing the name an hour later did not do it an hour
later.

## The week reads as a gradient of relevance

Today is warm, tall and dark-edged; **days that have already happened recede**
(`day-row--past`, `--past-face`). Shrinking past rows was the other candidate
and is the wrong tool: `min-height: 84px` exists because a short viewport
*clips* rather than degrading, today's `flex: 2.4` is calibrated against
`WEIGHTED_ROWS` in `useDetailLevel.ts`, and Monday still holds what happened on
Monday. Dimming de-prioritises; shrinking removes. `isPast` comes off the same
clock hook as `isToday`, so the week re-shades itself at midnight.

## Tapping the food opens the food

The board's meal chip opens the **recipe**. It used to open the meal *editor*,
so tapping the words "Chicken Katsu Curry" produced a dialog offering to change
it, mark it leftovers, or clear it — every one of those a thing you do to the
plan, and none of them the thing the chip is showing you. Managing the plan
moved one tap out, to the day view (tap the row, not the chip), which is the
right way round: changing what is for dinner is a planning act and belongs with
the day. The day view's meal rows follow the same rule — the title opens the
recipe, and "Change or clear this meal" is its own row.

## Price per serving

The shelf has a `$` toggle beside the help button. On, every card carries a
price per serving, the list resorts cheapest first, and the subtitle swaps the
recipe count for what is left of the week's grocery budget. Off — the default,
remembered per device in `localStorage` under `trellis.book-prices` — the book
is exactly what it was. The picker inside `MealEditor` is the same shelf, so it
gets all of this too, which is the point: the tap that spends the money is the
one in the picker, not the one in the book.

**The figure is consumed cost, not checkout cost.** `recipeCost` sums
`purchase_qty x` after-tax unit price with no rounding up to whole packages,
where `weekCost` groups by product and rounds each up. Both are named in
`005_price_book.sql` and they answer different questions: the week is a trip to
the shop, so it pays for whole packets; one recipe is a portion of that trip,
and "is this a cheaper dinner than that one" is about the food, not the
packaging. **So these numbers are not additive with the cart total and seven of
them will not reproduce it** — the same shared-ingredient effect `weekPackages`
exists for, pointing the other way.

Denominator is `servings_min`, not max and not the midpoint. Five recipes carry
a range, and the larger end is the flattering number; this figure is read at
the moment someone decides whether they can afford to cook something, so it
errs dear.

**The three states matter more than the number does.** After `015` the bank
prices completely for 14 recipes ($1.80–$3.24 a serving), partly for 1, and not
at all for 4:

- Complete — `$2.34` `a serving`.
- Partial — `$4.87+` `1 unpriced`, greyed figure, warning-coloured note. Rows
  with a product but no `purchase_qty` land here, as do rows with neither. Only
  the Udon stir-fry is left, on its "to taste" fresh ginger.
- Unknown — `—` `no prices yet`. The Tortilla Soup, the smoothie, and the two
  stubs.

Sorting buckets before it compares, so **a partial price can never outrank a
whole one**. Stuffed peppers is the case that shaped this: before `015` it
summed to $1.66 a serving with three ingredients missing a `purchase_qty`, and
left to sort on the number it would have sat at the top of a list whose entire
job is finding the cheapest dinner, which is the opposite of true. It prices
honestly at $1.82 now — keep the guard anyway, since the next unpriced
ingredient anyone adds will need it. `recipeCost` also requires `cents > 0`
before it claims to know anything, or the Protein Berry Smoothie, whose only
priced row is water at 0, announces itself as a free meal.

**The price control is a fifth filter row, not a button.** `PRICE_OPTIONS` in
`lib/recipeFilters.js`: `Off` / `Per serving` / `Cheapest first`. It began as a
"$" toggle beside the help "i" in the search row, which was wrong twice — filed
next to a control about the book rather than with the four controls about the
recipes in it, and conflating *seeing* a price with *sorting* by one, so there
was no way to browse alphabetically while still seeing costs. Three named
states fix both. Only `cheapest` reorders. The stored value migrates: the old
button wrote `'on'`, which meant prices *and* the sort, so it reads back as
`cheapest`.

**The budget figure names its week.** `cost` derives from `mealPlan`, which is
fetched for `anchor`'s week — so it follows the board, not the calendar. `Wall`
passes `budgetWeekLabel` — null for the current week, `weekLabel(anchor)`
otherwise — and the subtitle carries it as its own segment ("$23.40 left ·
week of September 14 – 20 · cheapest first"), because "left this week" while the board shows next week is a small
lie of exactly the kind this app tries not to tell. **`ShoppingPanel`'s cart
footer still says "Left this week" unconditionally on the same anchored
figure** — same bug, older, not yet fixed.

Two things to know if this is ever extended:

- `manual_cost_cents` counts here and does **not** count in `weekCost`. Every
  manual price in the bank today is 0 (soy sauce, spices, water — pantry rows
  Ed marked as free), so the discrepancy is invisible. The day someone types a
  real one, the recipe and the cart will disagree until that is reconciled.
- **`price_source` cannot be tested with `not like '%receipt-confirmed%'`.**
  The two values are `'…; receipt-confirmed'` and `'…; not receipt-confirmed'`,
  so the negative contains the positive and that test matches both — every
  screenshot-derived price then reads as receipt-confirmed. The first draft of
  `015` did this and promoted Stuffed peppers to `cost_confidence = 'receipt'`
  before it was caught. Match `'%not receipt-confirmed%'` instead. No recipe in
  the bank is fully receipt-priced, so **any row reading `'receipt'` means this
  has happened again** — 14 are `estimated`, 5 are `unknown`.
- `RecipeDetail` does not show a price. The toggle lives in the shelf's own
  state, and the detail sheet is its sibling under `Wall`, not its child. Cost
  in the detail view wants the per-ingredient breakdown anyway, which is a
  different piece of work.

## Hold a thing to manage it

`hooks/useLongPress.js`, used by `EventChip` and the two configurable rows of
`MainMenu`. Tap does the obvious thing to an object; hold gives you the
management view of the same object:

| Chip | Tap | Hold |
|---|---|---|
| Meal | Opens the recipe | Change / leftovers / clear |
| Chore | Ticks it | The chore sheet — day, kind, priority, delete |
| Event | Opens the editor | The same editor |

**Uniform even where it is redundant.** Holding an event opens what tapping it
already opens, because a gesture that works on two kinds of chip and silently
does nothing on the third is a gesture nobody learns. The board's own
background long-press (settings) is unchanged and still bails on any
`button, input, a, label`, so the two never compete for the same press.

Two things the hook exists to get right, both of which bit this codebase
before in other forms:

- **A long press still ends in a click.** Without `consumeClick`, holding a
  meal chip opens the meal editor *and* the recipe behind it. Read-and-clear,
  because it must be true for exactly one click with no render in between.
- **Cancel on scroll, not just on drag.** `pointercancel` covers the browser
  taking the gesture; the 12px slop covers the part before it decides to.

`LONG_PRESS_MS` (650) and `LONG_PRESS_SLOP_PX` (12) now live in the hook and
are imported by `Wall`, which used to declare its own copies.

**Discoverability is the hard part of a hold, and it is deliberate here.** The
day view's "Change or clear this meal" row says "or hold its chip on the
board", and the menu rows print "Hold to change where it shows" — the slow path
teaches the fast one. This matters more than usual in this app: the `MainMenu`
docstring exists because settings used to be reachable only by an undocumented
long-press, so shipping a second secret gesture would be a poor joke.

## Swipe a row left to delete it

`components/SwipeAway.jsx` wraps a row rather than being built into one — the
three places that want it (chore rows, shopping rows, the day sheet's tasks)
have three different row components and only this behaviour in common.

**Why a gesture, when both lists had refused a delete button.** The shopping
dock has none on purpose: a permanent 44px "×" beside the primary tap is a
mis-tap generator on a wall, for something done about once a month. The chore
row went the same way and moved delete two taps down into its settings sheet.
Both were right against the options available, and both left the common case
slow. A swipe costs no pixels at rest, sits nowhere near the tap target, and
cannot be triggered by the imprecise press a wall attracts — so the dock can
finally have the action without the neighbour. `removeButton` on
`ShoppingAisles` is now separate from `onRemove` for exactly this: *may* this
row be deleted, versus does it carry a button saying so. The dock answers yes
and no.

**The reveal's width *is* the swipe, and that is not a detail.** It first
spanned the row at `inset: 0` and relied on the row covering it until swiped.
The row does not cover it — `.checklist-row` sits on `--row-face`, which is
3.5% ink — so every row on the board wore a red tint with the word "Delete"
showing through it, printed across the schedule label on its right, at rest,
with nobody touching anything. It took a photograph of the actual wall to
catch: the harness rows were opaque. A reveal that has to be *covered* to stay
hidden is one repaint away from being visible; one with no width cannot be.
The label fades in only once the panel is wide enough to hold it, since a
right-anchored word in a narrow box clips its own left side and "Delete" spends
the early swipe reading "ete".

**`touch-action: pan-y` on the track is the load-bearing declaration**, the
same trick `.panel-row__grip` uses in the other direction. It hands vertical
panning to the browser and keeps horizontal, so a swipe and a list scroll
never have to out-race each other. The engagement test (12px, and horizontal
must beat vertical by 1.4×) is the second line of that defence for pointer
devices, where `touch-action` does nothing.

Three more things it has to get right, all verified in a harness:

- **A swipe ends in a click.** Without the capture-phase swallow, swiping a
  chore away also ticks it on the way out.
- **Delete happens on release, past 96px** — not on a revealed button. That
  was tried and rejected: the reveal-then-press pattern is safer in theory and
  Nick preferred the single gesture, which the undo below makes affordable.
- **Nothing is irreversible.** Every caller already routes through
  `offerUndo`, so a swipe lands the same nine-second undo a sheet delete
  does. That is what makes the gesture affordable on a wall people brush past.
- **The old routes stay.** The chore sheet still deletes and the shopping page
  keeps its "×" — a gesture with no keyboard and no screen-reader equivalent
  cannot be the only way to do anything.

Deliberately not applied to meals or events in the day sheet. Clearing a meal
is not deleting a row — the meal plan keeps the night — and an event carries a
time, an owner and a delete button already inside its own editor.

**Testing it is harder than writing it**, and the trap is worth recording:
React flushes `pointermove` at non-discrete priority, so reading
`style.transform` straight after `dispatchEvent` returns the *previous*
render's value. An early pass looked like the gesture was dead when it was
working perfectly. Step the synthetic pointer events through `setTimeout`
(not `requestAnimationFrame` — that does not fire in a background tab) and
read after each.

## Adding a task to a day

The day view had "Add event" and nothing else, so a day was somewhere things
happened *to* you. The board could already land a task on a date — 009 gave
chores `due_on`, 012 the drag — but only by dragging a row that already existed
out of the To Do panel; there was no way to have the thought "I should do that
on Thursday" while looking at Thursday.

`DayView` now has a Tasks section: what `tasksFor(date)` finds (the same
`isScheduled` + `occurrenceFor` test the week grid's chips use, so the sheet and
the board cannot disagree), tapping ticks, holding opens the chore sheet
(the same `useLongPress` the chips use — a right-click is not a thing that
happens on a wall-mounted iPad), and an `AddRow` captures new ones.

**A capture field rather than a footer button, and the asymmetry with events is
the point.** An event needs a time and an owner, which is a form. A task is one
line of text, and the field parses the rest off the end of it.

`addChore` takes a third argument, `whenUnspecified`, which is the schedule to
use when the typed text names none. The To Do panel passes nothing and behaves
as it always has. The day sheet passes `{ recurrence: 'once', due_on: <that
day> }`. **It loses to the text rather than overriding it** — typing "bins out
every tuesday" into Thursday's sheet gives a Tuesday chore, and the capture
field's own readback says "Tuesdays" before the row is written, so the sheet
never silently reinterprets what someone typed.

## Chores, which are also tasks

**One table holds both, deliberately** (014). A *task* is a chore whose
`recurrence` is `'once'` — that is not a workaround, it is what `'once'` has
meant since 009, where `due_on` is already the due date. The alternative
considered and rejected was a separate `tasks` table: it models the difference
more honestly (a chore rotates and is never finished; a task is done once and
gone) at the cost of two lists, two panels and two mental models in a
household of two.

014 added `priority` (0–3, rendered only above 0), `notes`, `starts_on` and
`parent_id`. All four are recurrence-agnostic — a weekly chore can carry a
priority as sensibly as a one-off can. Only the *date* is specific to a kind,
and it already existed, which is why `chores_schedule_matches_recurrence` is
untouched.

The table keeps the name `chores` even though the concept is now broader. The
panel has read "Weekly To Do" since the redesign, so the user-facing noun was
already "task" and only the storage still says "chore"; renaming would touch
the completion log, the `chore_last_done` view, every RLS policy and four
constraints to settle a question the UI settled differently.

**Subtasks are one level deep and stay that way.** `groupChores` pulls
children out of the top-level grouping and hangs them off their parent
wherever the parent landed, so a subtask never groups on its own — its whole
meaning is "part of that". A list that grows a tree needs an outliner, and an
outliner on a wall-mounted iPad is a worse version of a list.

**Only a dated one-off can be overdue.** A weekly chore has one occurrence a
week and clears each Sunday, so "you missed Tuesday" is not a state it can be
in. `groupChores` puts late work in its own group above everything else,
because the one group that reports something having gone wrong is the one that
must not be buried under today's work.

### Fast capture

`src/lib/capture.js` reads scheduling and priority off the end of typed text,
so "bins out every tuesday !!" lands as a Tuesday chore at high priority
rather than as an untimed weekly one that then needs a sheet opened to finish
it. Two rules keep it from being annoying:

- **Matches are end-anchored, never mid-string.** "Buy tickets for Monday's
  show" has to stay a task with that name. Any parser that matches dates
  anywhere in the text eventually eats a word somebody meant, and on a shared
  wall the person who typed it is not the person who finds it broken.
- **Nothing is applied silently.** `parseCapture` returns the labels it
  matched and `AddRow` shows them back — "Tuesdays · Medium" — before the row
  is written. A parser you cannot see is one you stop trusting the first time
  it guesses wrong.

`"next friday"` means the Friday *after* the coming one. English genuinely
disagrees about the phrase; the tie-break is structural, since bare `"friday"`
already means the coming Friday and a modifier that changes nothing is worse
than either reading.

No slash dates: `12/9` is September in one hemisphere and December in another,
and this app renders dates through the device locale, so guessing wrong would
stay invisible until something happened on the wrong day.

## Surfaces

**Paper on a board.** The ground (`--plaster`) is a warm light grey; panels
and day rows (`--slat-face`) are near-white paper, with `--lift` giving the
dock panels a soft two-layer shadow. These used to sit within 11 levels of
each other, so nothing read as being *on* anything — the board was one olive
field with faint rectangles drawn on it. Most of the depth comes from the
contrast; the shadow only confirms it.

The ground stays warm rather than going pure white deliberately: this screen
is on a wall in a room people relax in, and a full-brightness white field is
the light-pollution problem Feature #5 exists to solve.

**`--chip-face` and `--row-face` tint down, not up.** Both were white at
~50–60% alpha, which worked on an olive panel and became invisible the moment
panels turned to paper. A row inside a white panel has to recess. If you add a
new surface, check which ground it sits on before reaching for either.

**Today's row is warmer, not brighter** (`--today-face`). It cannot out-lighten
a near-white row, so it separates by warmth instead — helped by the 2.4× height
and the 14px dark left edge it already had.

**Filled means recorded.** `.card .chip.on`, the whodunit badges, the checklist
tick: a solid fill is a fact, never a suggestion. This rule has now been broken
twice in opposite directions — once by a specificity bug that made *unselected*
chips the loud ones, and once by the episodic row filling the badge of whoever
was up *next*, so a row reading "Ed, yesterday · Nick's turn" put the solid
badge on Nick. Point at a person with `--person-a-tint` / `--person-b-tint` as
a ring; reserve the fill for something that happened.

## Motion

`tokens.css` owns the motion system. Durations name the *job* rather than the
number — `--dur-tap` (press feedback), `--dur-state` (ticked, selected),
`--dur-move` (reorder, sink), `--dur-layer` (a sheet arrived) — with
`--ease-enter` / `--ease-exit` / `--ease-standard`. Before this there were
five hand-picked durations and mostly a bare `ease`, so two controls doing the
same kind of thing moved at different speeds for no reason.

Everything is short, and nothing decorative loops: this runs on a
wall-mounted iPad people tap in passing, where a looping animation is both a
battery cost and a burn-in risk. The reduced-motion media query in
`tokens.css` zeroes the durations, which is the default answer for any new
component — but per-component blocks that also suppress an `:active`
transform are still needed and still there, because a transform with no
duration still snaps.

## Chore recurrences

Three recurrences, and the third exists because the first two could not
describe the chore this household does most.

- **`weekly`** — a rhythm. One occurrence per week, keyed to `scheduled_day`
  or, unscheduled, to the week's Sunday. Renders as a checkbox.
- **`once`** — an errand on a date (`due_on`). Checkbox.
- **`anytime`** (012) — *episodic*. No schedule, no done-ness. Its completions
  key to **today**, so four dishwasher runs in a week are four rows rather
  than one. Renders as a log line plus one button per person.

**Why `anytime` had to exist.** Nick and Ed alternate the dishwasher three or
four times a week on no schedule. As a `weekly` chore it had exactly one
tickable occurrence per week, so three of four runs could not be recorded and
which one survived was arbitrary. The data agreed: four chores, zero
assignees, and not one completion ever logged. A control that discards most
of what you tell it teaches you to stop using it.

**Whose turn is derived, never stored.** `chores.rotates` says a chore
alternates; `nextTurn()` in `src/lib/chores.js` answers who is up by asking
who did it last. A `next_person_id` column would be a second source of truth
that drifts from the log the first time someone ticks out of order. `nextTurn`
returns null — and the UI says nothing — when there is no history, the chore
does not rotate, or the last person has left the household. It never guesses.

**The wall cannot tell who tapped, so it asks.** `toggleChore` credits
`profile.id`, which is right on a phone and wrong on the wall: one signed-in
session shared by two people would have credited every completion to the same
name forever, quietly poisoning both the log and the future scoreboard
(Feature #6). Episodic rows therefore have one button per person instead of a
checkbox — attribution and completion in the same tap. `logChore` upserts on
`(chore_id, on_date)`, so tapping the other person corrects the credit rather
than failing on a duplicate.

**Scheduling has two doors.** Dragging (`useChoreDrag`) is unchanged and is
still the fast path. Tapping the schedule label opens `ChoreSheet` because
drag was the *only* path, and on a wall-mounted iPad it means hauling a row
out of a scrolling dock panel, across a 13" screen, onto a target that may be
scrolled out of view. It was also the only path, full stop, for anyone who
cannot make that gesture. One-offs are not offered weekdays; they carry a
date, which wants a calendar, so dragging remains the way to move them.

**`ChoreSheet` holds everything the row is not for** — recurrence, weekday,
whether it rotates, and deleting. The row itself carries exactly one primary
action. It previously carried four hit zones (grip, tick, schedule pill, a
permanently-resident delete ×) in a ~350px column, with the destructive one
next to the quiet one.

**The recurrence control is also the only way to make anything but a weekly
chore.** `addChore` writes `recurrence: 'weekly'` and still does, deliberately
— capture stays one field. Until `ChoreSheet` existed, `anytime` and `once`
were reachable only by hand-written SQL, so 012's whole point was unreachable
from the app that needed it. `recurrencePatchFor` clears the incompatible
scheduling column in the same write, because
`chores_schedule_matches_recurrence` rejects a row that holds the wrong one.

An `anytime` chore has no day at all: `schedulePatchFor` returns null and a
drop on the grid does nothing visibly, rather than appearing to work until
the next refetch undoes it.

## Authentication

Sign-in is an **8-digit code emailed and typed into the app** — not a magic
link. Settled the hard way; the constraints below are all load-bearing.

- **The link cannot sign in the wall.** On iOS a Home Screen web app has its
  own storage container, separate from Safari. Tapping a link in Mail opens
  the *default browser*, so the session is created in Safari while the app
  that asked for it stays signed out. Requesting another email repeats it.
  A code has no browser hop, so whichever surface asked for it is the one
  that ends up signed in.
- **Codes are 8 digits here, not the usual 6.** Length is a Supabase project
  setting (Auth → Providers → Email) and `CODE_LENGTH` in `App.jsx` mirrors
  it — keep them in step. An earlier `maxLength={6}` truncated the code and
  submitted an invalid token, which Supabase reports as "Token has expired
  or is invalid": identical wording to a genuinely stale token, and it sent
  a whole evening after a mail-scanner theory that was wrong. **Any future
  "invalid token" should start by checking what the client actually
  submitted, not why it might have expired.**
- **The email template carries `{{ .Token }}` and not
  `{{ .ConfirmationURL }}`.** Those are the same one-time token in two
  forms, and a link that anything prefetches is a link that spends the
  token. Each new send also invalidates the previous one, so only the newest
  email is ever valid — older ones look identical and are dead.
- **Email goes through custom SMTP** (Gmail, App Password,
  smtp.gmail.com:587). Two reasons: Supabase's built-in sender is rate
  limited to a handful per hour and blocks sign-in entirely once tripped,
  and on the free tier custom SMTP is the *only* way to edit the templates
  at all — the dashboard gates template editing behind it, offering Pro as
  the alternative. Gmail suits a two-person household better than Resend,
  whose free tier won't send to a second person without a verified domain.
- **Sessions are per-origin.** `localhost`, a LAN IP, and the Vercel domain
  are three different logins, and the Home Screen app is separate again. The
  wall runs from the Vercel URL so it survives the Mac being asleep.
  `persistSession` + `autoRefreshToken` mean it should not need signing in
  again.

## Open items from the last session

- **The ambient screen timeout has not been seen on the wall.** Everything
  checkable in a browser is checked (fade, night variant, swallowed wake touch,
  pause when hidden, and that the drift layers genuinely move — ~4.9px in 2.5s
  on a 137s period). What a browser cannot answer is whether it holds up over
  weeks without heat, battery drain or memory growth, which is the entire point
  of the feature. **Confirm iPadOS Auto-Lock is set to Never** first, or the
  device blanks the screen before Trellis ever gets to show anything.
- **Nothing on the wall has ever written a non-dinner meal.** Slots work and
  are reachable, but the household has only ever planned dinners, so breakfast
  / lunch / snack are untested against real use rather than untested against
  code. Watch whether they get used at all before building anything further on
  them — `RecipeDetail`'s dinner-only "Plan a night" is the obvious next
  question, and it is only worth answering if the answer matters.
- The menu's cook row picks dinner, or the last planned slot if there is no
  dinner. It ignores the time of day, so a day with both a breakfast and a
  dinner offers the dinner all morning.
- `mealsFor` and the days memo each filter `mealPlan` per day, so rendering a
  week is 7 passes over the plan. Irrelevant at 7–28 rows; worth an index if
  meal planning ever shows more than a week.
- Still no test runner, and this session added three more pure modules that
  want one — `meals.js` (`nextFreeSlot`, `bySlot`), `screensaver.js`
  (`timeoutMsFor`, `isNightAt`) and `cookProgress.js` (the 6-hour expiry).
  Together with `cost.js`, `week.js` and `useToday`, that is now a real case
  for just adding vitest.

- Slice 9 is verified on the wall (8 Sep 2026): long-press with a fingertip,
  full-screen Home Screen launch, the 180ms sheet transition, and the
  Live/Offline header — Airplane Mode flips it to Offline and it recovers on
  reconnect. The midnight rollover showed the correct day, but the app had
  almost certainly reloaded overnight, and a reload produces the right day
  whether or not the timer fired; treat it as consistent rather than proven.
  A quiet night with no deploys would settle it, though nothing depends on
  settling it.
- No test runner. `cost.js`, `week.js` and `useToday`'s date maths are pure
  and worth covering; checking them this session meant hand-rolling an
  esbuild + node harness, which is the signal to just add vitest.
- Unpriced ingredients are now surfaced twice: the cart footer counts them,
  and the Shopping full page names them under "Not on the list" with the
  recipe each came from. An ingredient with no product is missing from the
  total *and* from the list, and the page is the only place that says which.
- `removeChore` / `removeShopping` delete optimistically and swallow the
  error, unlike the toggles which refetch on failure.
- `public/favicon.svg` is still the purple template bolt, off-palette. The
  home-screen icon (`apple-touch-icon.png`) was redrawn in the real palette;
  the browser-tab favicon wasn't.
- README is still Vite template boilerplate.
- Decide whether to bring back a to-do list UI, and if so, where — no
  design surface currently exists for a third dock section, and
  `SectionDock` hardcodes two children.
- Landscape orientation isn't tuned.
- Broader "personality" pass was requested (typography done — real
  Fraunces/Figtree now installed — but color/texture/voice was only
  brainstormed, not decided or implemented).
- Person avatars: direction settled in `docs/backlog-person-avatars.md`,
  blocked on Nick supplying a photo of each of them.
- **The enrichment ran** (`010_recipe_enrichment_run.sql`, applied to the live
  project). 16 descriptions, 15 cuisines, 16 tag sets, 16 meal-type sets, all
  127 ingredients normalised and categorised, 8 preparations extracted from
  text that already said them. `enrichment_status` is now 13 `enriched` /
  5 `needs_review` / 0 `pending`.

  **010 left the times, efforts and methods null; `011_recipe_estimates.sql`
  then filled them on Nick's explicit instruction to override that.** So every
  prep time, total time and the three newest methods are model estimates that
  nobody has cooked or timed. They are all `ai_enrichment` at confidence
  0.60–0.75, against 1.00 for Ed's own figures, and this is the query that
  separates them:

      select r.title, p.field_name, p.confidence
        from recipe_field_provenance p join recipes r on r.id = p.recipe_id
       where p.confidence < 0.80 order by r.title;

  46 rows. Treat them as placeholders to correct against a real timer, not as
  facts. The book still renders an estimate identically to a measurement — if
  that ever matters, the UI needs to show confidence, which it does not yet.

  `steps` is now a valid `field_name` in `recipe_field_provenance` (011 widened
  the whitelist; 008 never imagined enrichment writing a method). Ed's 13
  methods are recorded as `existing`, the 3 model-written ones as
  `ai_enrichment`. Do not collapse that distinction — it is the difference
  between instructions a person tested and instructions a model produced.

  `trellis_may_enrich(recipe_id, field)` is the re-run gate: it asks whether a
  field is held by something outranking `ai_enrichment` before writing, so a
  second pass overwrites its own previous answer and skips anything a human
  has since corrected. 008's trigger only refuses a downgrade *at write time*,
  which would abort a whole re-run; this makes the skip a query instead.
  Verified by test: a description marked `user_supplied` survives a re-run.

  One wrinkle worth knowing: 008's backfill set `normalization_source =
  'existing'` on all 127 ingredient rows, but that column describes the
  *normalisation*, and those columns were null. Read strictly by rank,
  `existing` (35) outranks `ai_enrichment` (20) and no ingredient could ever
  be normalised. 010 therefore gates ingredients on `normalized_name is null`
  — the gap itself — which is what 008's prose intended.
- **`recipes.est_cost_cents` is declared in `004_recipes.sql` and does not
  exist on the live table.** The repo and the database drifted at some point
  before 008. This shipped a broken recipe book once: PostgREST 400s the whole
  request on one unknown column rather than omitting it, so selecting it made
  the book open to an empty shelf under a red "column recipes.est_cost_cents
  does not exist". Check the live schema before adding a column to any select
  string — finding it in a migration file is not the same thing. Note also
  that a PostgREST select string is not SQL and takes no `--` comments.
- Two recipes still read `needs_review`, and both need a person rather than
  another model pass: **Filthy cabbage** (retired; zero ingredients, zero
  steps, and no notes beyond its retirement — the name is the only information
  that exists, so 011 left it entirely alone) and **Steak salad**
  (conditional; 011 gave it servings and times, but a method needs ingredients
  and there are no ingredient rows). The book's "Needs work" filter finds
  exactly these two.
- Recipe images: nothing to build in the schema, everything to decide about
  sourcing. Written up in `docs/backlog-recipe-images.md`. Recipe artwork must
  stay inside sheets and off the always-on board (image retention).
- Recipe servings aren't scalable in the book. Doubling a recipe means
  trusting the quantities, and 7 of 127 ingredient rows have no quantity at
  all, so it was left out rather than shipped half-right.
