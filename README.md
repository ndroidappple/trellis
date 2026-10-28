# Trellis

A shared household calendar for two people, built to run full-screen on an
11" iPad Pro docked on the kitchen counter, with each person's phone used for
quick checks. One board shows the week, the to-do list, the shopping list and
what's for dinner, and it stays in sync live between devices.

Vite + React on the front end, Supabase (Postgres, auth, realtime, storage,
edge functions) behind it. Deployed on Vercel.

## What's on the board

- **The week.** A Sunday-start week grid with events, meals and dated tasks.
  Today is emphasised and past days recede. Swipe to change weeks, tap a day
  for its full view.
- **To Do.** Weekly chores, one-off tasks with a due date, and "anytime"
  chores (like the dishwasher) that log each run and track whose turn it is.
  Typing "bins out every tuesday !!" sets the schedule and priority from the
  text itself.
- **Shopping.** Grouped by aisle in walking order, with quantities and a
  weekly grocery cost projected from the meal plan against a budget.
- **Meals and recipes.** A recipe book with search, filters, photos, and an
  optional price per serving. Plan breakfast, lunch, dinner or a snack on any
  day. Cook mode shows one step at a time in large type, keeps the screen
  awake, and remembers where you left off.
- **Ambient screen.** After a configurable idle time the board fades into a
  slowly growing trellis with the time on it, with a darker night variant.
  It keeps moving to avoid burn-in on an always-on display.
- **Settings.** Dock layout, screen timeout (per household and per device),
  night hours, grocery budget, display names, and Google Calendar.

Gestures are consistent everywhere: **tap** does the obvious thing, **hold**
opens the management view, and **swipe left** deletes a row (with undo).
Holding an empty part of the board opens Settings.

### Still in progress

- **Google Calendar (read-only).** The schema, edge functions and connect UI
  exist. It needs a Google OAuth client and secrets configured before it does
  anything (see below).
- **Home (lights and scenes)** is a UI shell. Every device is a placeholder,
  and nothing is connected to Home Assistant or Sonos yet.

## Getting started

Requires Node 20.19+ or 22.12+ (Vite 8's minimum) and a Supabase project.

```bash
npm install
```

Create `.env.local` in the repo root (it's gitignored):

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
# Optional: enables the Google Calendar "Connect" button
VITE_GOOGLE_CLIENT_ID=<google oauth client id>
```

Then run the dev server at http://localhost:5173/:

```bash
npm run dev
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build. Also the quickest compile check, since there's no separate typecheck |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

**`npm run build` refuses to run without the Supabase variables, on
purpose.** Without them the bundler silently tree-shakes the whole app away
and emits a blank page that still "builds successfully". The guard in
`vite.config.js` turns that into a loud failure, so leave it in. A
`git worktree` doesn't inherit `.env.local`, so copy it in before building
there.

## Database

Migrations live in `supabase/migrations/` (`001`–`021`) and rebuild the full
schema from scratch. Run them in order in the Supabase SQL editor.

- **Signup is an allowlist.** `handle_new_user()` in `001_initial_schema.sql`
  names the two household email addresses. Edit it to change who can sign in.
- **RLS is the security boundary.** Every policy resolves through
  `current_household_id()`, so a user with no profile row sees nothing.
- **`006_seed_meal_hq.sql` is destructive on re-run.** It wipes products and
  staples before reseeding, and resets the weekly budget. Fine for a fresh
  project, not for the live one.

### Sign-in

Users sign in with an **8-digit code emailed to them**, not a magic link. On
iOS a Home Screen web app has its own storage, so a link would sign in Safari
instead of the app. To match this, the Supabase project needs:

- Auth → Email → OTP length set to **8** (mirrored by `CODE_LENGTH` in
  `src/App.jsx`)
- The email template using `{{ .Token }}`, not `{{ .ConfirmationURL }}`
- Custom SMTP, both to avoid the built-in sender's rate limit and because the
  free tier only allows template edits with custom SMTP

### Google Calendar (optional)

Two edge functions in `supabase/functions/` handle the OAuth callback and the
sync. To turn it on:

1. Create a Google Cloud OAuth client with the `calendar.readonly` scope, and
   add `<SUPABASE_URL>/functions/v1/google-oauth-callback` as a redirect URI.
2. Set the edge function secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   and `APP_URL`, then deploy both functions.
3. Set `VITE_GOOGLE_CLIENT_ID` in the app's environment.

Refresh tokens are stored in `calendar_connections`, which has RLS on and no
policies, so only the service role can ever read them.

## Running it on the iPad

1. Open the deployed URL in Safari and use **Share → Add to Home Screen**.
   Launched from there it runs full-screen with no browser UI, and the layout
   is calibrated for that full height.
2. Set **Settings → Display & Brightness → Auto-Lock → Never**, or iPadOS
   blanks the screen before Trellis's own ambient screen ever appears.
3. Sign in once. Sessions persist and refresh on their own, but each origin
   (localhost, a LAN IP, the Vercel domain, the Home Screen app) is a
   separate login.

Portrait and landscape are both supported and detected automatically.

## Project layout

```
src/
  App.jsx              auth gate (emailed code) → Wall
  components/
    Wall.jsx           orchestrator: all Supabase reads and writes live here
    Board.tsx, WeekGrid.tsx, ...   the visual design system
    ChoresPanel.jsx, ShoppingPanel.jsx, PanelSheets.jsx
    RecipeBook.jsx     shelf, recipe detail, and cook mode
    SettingsSheet.jsx, MainMenu.jsx, HomeSheet.jsx, Screensaver.jsx
  hooks/               long-press, swipe, idle, orientation, realtime, today's date
  lib/                 pure logic: dates, cost, shopping aisles, capture parsing,
                       chores, meals, screensaver timing
  tokens.css           colours, type, spacing and motion tokens
supabase/
  migrations/          full schema, 001–021
  functions/           Google Calendar OAuth callback and sync
docs/                  feature backlog and design write-ups
```

## Further reading

- **`CLAUDE.md`** is the detailed design record: why things work the way
  they do, the bugs that shaped them, and the open items. Read it before
  changing anything non-trivial.
- **`docs/feature-backlog.md`** has the numbered features, shipped and
  planned.
- **`docs/`** also holds write-ups on recipe images, person avatars, and the
  abandoned widget home screen.

There's no test runner yet. `npm run build` and `npm run lint` are the
checks to run before pushing.
