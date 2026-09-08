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

- `src/App.jsx` — auth gate (Supabase magic-link email OTP) → `Wall`
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
- `src/lib/supabase.js` — client, reads `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` from `.env.local` (gitignored via the `*.local`
  rule).
- `src/lib/week.js` — date helpers, Sunday-start week, no date library.
- `src/lib/cost.js` — weekly grocery cost projection from the meal plan
  (leftover nights are free; shared ingredients across recipes are
  deduped to whole packages before pricing).
- `src/tokens.css` — design tokens (colors, type, sizing). Real Fraunces
  (display serif) + Figtree (text sans) fonts are installed via
  `@fontsource-variable/fraunces` / `@fontsource/figtree`, imported in
  `main.jsx`.
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
  but you can't tap it to cycle to someone else anymore.
- **Landscape iPad orientation** — row/panel minimum heights (see below)
  are tuned for portrait (1024×1366pt, the "12.9" iPad in portrait" this
  was built for per the original design comments). In landscape the dock
  panels will get tight or clipped. Not addressed yet.

**Settings:** long-press the board (~650ms) opens a dialog to set each
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

## Open items from the last session

- Slice 9 is unverified on the actual iPad. The midnight rollover was
  checked as arithmetic and the offline states as code paths — neither has
  been watched happening on the wall.
- No test runner. `cost.js`, `week.js` and `useToday`'s date maths are pure
  and worth covering; checking them this session meant hand-rolling an
  esbuild + node harness, which is the signal to just add vitest.
- `weekCost` returns `unpricedIngredients` and the UI discards it, so the
  cart footer presents a possibly-undercounted total as authoritative.
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
