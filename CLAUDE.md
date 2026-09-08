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

  **⚠️ A green build does not mean the app is in the bundle.**
  `src/lib/supabase.js` throws at module scope when `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` are missing. Vite inlines those at build time, so
  with no `.env.local` the throw becomes unconditional, Rolldown treats
  everything downstream as unreachable, and it tree-shakes the entire app
  away — exiting 0, reporting all modules transformed, and emitting full CSS.
  The only tell is bundle size: ~430 kB with the app, ~199 kB without.
  A `git worktree` won't have `.env.local` (it's gitignored), so copy it in
  before trusting a build there. The same trap applies to any CI or Vercel
  build with unset env vars: it "succeeds" and ships a blank screen.
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

**⚠️ Migration gap:** `supabase/migrations/` only has `001`–`003` and
`007`. Migrations `004_recipes.sql`, `005_price_book.sql`, and
`006_seed_meal_hq.sql` were run directly against the live Supabase project
during the session but were never saved into this repo — the recipes,
products, and meal-plan seed data all exist in the database, just not as
files here. If you need to reconstruct the schema from scratch (a new
Supabase project, a teammate's local setup), those three files are
missing and would need to be regenerated or pulled from Supabase's own
migration history. Worth fixing at some point — either pull the current
schema via `supabase db dump` and reconcile, or just recreate 004–006 from
what's actually in the database.

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

- Reconstruct or reconcile migrations 004–006 (see gap above).
- Decide whether to bring back a to-do list UI, and if so, where — no
  design surface currently exists for a third dock section.
- Landscape orientation isn't tuned.
- Broader "personality" pass was requested (typography done — real
  Fraunces/Figtree now installed — but color/texture/voice was only
  brainstormed, not decided or implemented).
