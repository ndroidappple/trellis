-- Trellis — Feature #19: Google Calendar, read-only
--
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- 002_event_sources.sql already prepared `events` for a read-only external
-- source (source / external_id / read_only) and named Google Calendar
-- directly in its own comment. This is that feature, four things:
--
--   1. calendar_connections — one row per person's connected calendar.
--   2. A fix to 002's uniqueness constraint, now that both Nick and Ed can
--      each connect their own calendar.
--   3. hidden_at on events — "don't show this on Trellis" without deleting
--      it from Google, and without a re-sync silently undoing the hide.
--   4. A safe, token-free way for the client to ask "is my calendar
--      connected" at all.

-- ---------------------------------------------------------------------------
-- calendar_connections
--
-- refresh_token is as sensitive as a password. Deliberately NO row-level
-- security policy is created for it below — enabling RLS with zero policies
-- denies every request from the anon/authenticated roles outright. The only
-- thing that ever reads or writes this table is the sync and OAuth-callback
-- Edge Functions, using the service role key, which bypasses RLS entirely.
-- Nothing in this table is meant to reach the browser, ever.
-- ---------------------------------------------------------------------------

create table if not exists calendar_connections (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  provider        text not null default 'google',
  calendar_id     text not null default 'primary',
  refresh_token   text not null,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (profile_id, provider, calendar_id)
);

alter table calendar_connections enable row level security;
-- No policies. See the comment above — that's the point, not an omission.

-- ---------------------------------------------------------------------------
-- What the client is actually allowed to know: that a connection exists,
-- never the token. security definer so it can read calendar_connections
-- (which the caller's own role cannot) while still filtering to the
-- caller's own household via current_household_id() — the same pattern
-- current_household_id() itself already uses.
-- ---------------------------------------------------------------------------

create or replace function calendar_connection_status()
returns table (
  id uuid,
  profile_id uuid,
  provider text,
  calendar_id text,
  last_synced_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select cc.id, cc.profile_id, cc.provider, cc.calendar_id, cc.last_synced_at, cc.created_at
  from calendar_connections cc
  where cc.household_id = current_household_id();
$$;

revoke all on function calendar_connection_status() from public;
grant execute on function calendar_connection_status() to authenticated;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

alter table events
  add column if not exists hidden_at timestamptz;
-- Set by tapping "Hide" on a synced event's read-only glance. The sync
-- Edge Function's upsert must update title/starts_at/etc. from Google on
-- every run but MUST NOT touch hidden_at, or a hide would be undone by the
-- next sync — the same shape as trellis_may_enrich protecting a
-- user-supplied recipe field from being overwritten by re-enrichment
-- (008_recipe_enrichment.sql). A hidden event still exists in Trellis and
-- still updates from Google; it just doesn't render.

-- 002_event_sources.sql's uniqueness assumed one external source total.
-- With both Nick and Ed able to connect their own calendar, Google's event
-- ids are only unique within one person's calendar — two different
-- accounts' ids are not guaranteed distinct from each other. owner_id
-- (already the column the board uses to attribute/colour an event) has to
-- be part of the key, or a collision between Nick's and Ed's calendars
-- could silently merge two unrelated events into one row.
drop index if exists events_source_external_idx;

create unique index if not exists events_source_external_owner_idx
  on events (source, external_id, owner_id)
  where external_id is not null;
