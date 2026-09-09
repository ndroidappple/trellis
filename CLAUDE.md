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
- `src/lib/week.js` — date helpers, Sunday-start week, no date library.
- `src/lib/cost.js` — weekly grocery cost projection from the meal plan
  (leftover nights are free; shared ingredients across recipes are
  deduped to whole packages before pricing).
- `src/tokens.css` — design tokens (colors, type, sizing). Real Fraunces
  (display serif) + Figtree (text sans) fonts are installed via
  `@fontsource-variable/fraunces` / `@fontsource/figtree`, imported in
  `main.jsx`.
- `src/components/RecipeBook.jsx` — the recipe book, in three layers:
  `RecipeBook` (the shelf: search over titles *and* ingredient names, four
  filters), `RecipeDetail` (one recipe, plus "plan a night" against the week
  currently on the board), and `CookMode` (one step at a time at 40px, holding
  a screen wake lock). Reached from a `Recipes` button in the board header, or
  from a day view that already has a meal on it. `Wall.jsx` fetches the whole
  bank in one lazy query (`RECIPE_BOOK_QUERY`) the first time the book opens —
  18 recipes / 127 ingredients / 56 steps is small enough that this beats a
  round trip per recipe, and the detail view then opens with no spinner.
  The meal picker inside `MealEditor` is deliberately untouched: tapping a
  recipe there still lands the chip on the board in one tap.
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
