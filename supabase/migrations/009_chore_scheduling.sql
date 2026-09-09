-- Trellis — slice 11: chores get a day, and a memory
--
-- Run in Supabase AFTER 008_recipe_enrichment.sql. Safe to re-run.
--
-- Two things change, and the second is the one that matters.
--
-- 1. A chore can be scheduled. Overwhelmingly these are weekday slots —
--    "bins go out Tuesday" — with the occasional one-off date, so both are
--    supported and a chore can be moved between them.
--
-- 2. A chore remembers every time it was done, and by whom.
--
-- Until now a chore carried a single completed_at, which can answer "is this
-- done this week" and nothing else. It cannot answer "who ran the dishwasher
-- last", which is the question this household actually argues about, and it
-- cannot answer it because the information was never stored: each tick
-- overwrote the previous one and no tick recorded a person at all.
--
-- Splitting the template from its occurrences fixes both. `chores` becomes
-- the definition; `chore_completions` becomes the log.


-- ---------------------------------------------------------------------------
-- 1. Scheduling
-- ---------------------------------------------------------------------------

-- 0 = Sunday, matching startOfWeek() in src/lib/week.js and getDay() in the
-- browser. Deliberately not ISO's Monday=1: the board's weeks start Sunday,
-- and a second convention living next to the first is how off-by-one bugs
-- get written.
alter table chores add column if not exists scheduled_day smallint;

-- For the one-offs: a real date rather than a weekday.
alter table chores add column if not exists due_on date;

alter table chores drop constraint if exists chores_scheduled_day_range;
alter table chores add  constraint chores_scheduled_day_range
  check (scheduled_day is null or scheduled_day between 0 and 6);

-- A weekly chore recurs on a weekday; a one-off falls on a date. Neither
-- takes the other's field, so "which kind of scheduling is this" always has
-- exactly one answer and the UI never has to break a tie.
--
-- Both null in either case is legitimate and common: that is an unscheduled
-- chore sitting in the backlog, which is what every chore is today.
alter table chores drop constraint if exists chores_schedule_matches_recurrence;
alter table chores add  constraint chores_schedule_matches_recurrence
  check (
    (recurrence = 'weekly' and due_on is null)
    or (recurrence = 'once' and scheduled_day is null)
  );

create index if not exists chores_scheduled_day_idx
  on chores (household_id, scheduled_day);

create index if not exists chores_due_on_idx
  on chores (household_id, due_on);


-- ---------------------------------------------------------------------------
-- 2. The completion log
-- ---------------------------------------------------------------------------
--
-- on_date is the occurrence the completion belongs to, which is not the same
-- as when someone ticked it. Running Tuesday's dishwasher on Wednesday
-- morning completes Tuesday's occurrence; completed_at records the tap, and
-- on_date records what it was for. Keeping them separate is what lets the
-- board show a week honestly after the fact.
--
-- completed_by is the person who ticked it, deliberately not the chore's
-- assignee_id. Credit belongs to whoever actually did the thing — which is
-- the entire point of keeping this log, and the one field the old model was
-- missing.

create table if not exists chore_completions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  chore_id     uuid not null references chores(id) on delete cascade,
  on_date      date not null,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz not null default now(),

  -- One completion per occurrence. Ticking twice is idempotent rather than
  -- a way to farm the scoreboard, and unticking is a delete.
  constraint chore_completions_unique unique (chore_id, on_date)
);

create index if not exists chore_completions_week_idx
  on chore_completions (household_id, on_date);

-- Serves "who did this last": newest first, per chore.
create index if not exists chore_completions_recent_idx
  on chore_completions (chore_id, completed_at desc);

alter table chore_completions enable row level security;

drop policy if exists chore_completions_all on chore_completions;
create policy chore_completions_all on chore_completions
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

-- Guarded: adding a table to a publication twice raises rather than being a
-- no-op, and this file claims to be safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chore_completions'
  ) then
    alter publication supabase_realtime add table chore_completions;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Household integrity, same as 008
-- ---------------------------------------------------------------------------
--
-- A completion must belong to the same household as its chore. Composite
-- foreign key rather than a trigger, for the same reason as in 008: RLS
-- hides a mismatch from the app but does not prevent one, and a service-role
-- writer is not subject to RLS at all.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chores_id_household_key'
      and conrelid = 'chores'::regclass
  ) then
    alter table chores add constraint chores_id_household_key unique (id, household_id);
  end if;
end $$;

alter table chore_completions drop constraint if exists chore_completions_chore_id_fkey;
alter table chore_completions drop constraint if exists chore_completions_chore_household_fkey;
alter table chore_completions add  constraint chore_completions_chore_household_fkey
  foreign key (chore_id, household_id)
  references chores (id, household_id)
  on delete cascade;


-- ---------------------------------------------------------------------------
-- 4. Carry the existing ticks across
-- ---------------------------------------------------------------------------
--
-- Every currently-ticked chore becomes one completion, so nothing appears to
-- un-tick itself the moment this runs.
--
-- completed_by is null for these, and that is the honest answer: the old
-- model never recorded who did anything. The scoreboard should exclude
-- null-person completions rather than guess — a wrong attribution in a
-- feature built to settle arguments would be worse than a gap.
--
-- Nothing finer than the week can be recovered for a weekly chore, because
-- nothing finer was ever stored.

-- on_date has to be the key the app will look the occurrence up by, not
-- simply the day of the tick, or every currently-ticked weekly chore
-- un-ticks itself the moment this runs.
--
-- The scheme, which src/components/Wall.jsx must match exactly:
--
--   weekly, scheduled_day W   -> week start (Sunday) + W
--   weekly, unscheduled       -> week start (Sunday)
--   once,   due_on D          -> D
--   once,   unscheduled       -> the date it was done
--
-- Nothing has a scheduled_day yet, so every weekly chore backfills to its
-- week start. extract(dow) is Sunday=0, which is the convention the whole
-- board already uses.
with ticked as (
  select c.household_id,
         c.id as chore_id,
         c.recurrence,
         c.completed_at,
         c.completed_at::date as done_date
  from chores c
  where c.completed_at is not null
)
insert into chore_completions (household_id, chore_id, on_date, completed_by, completed_at)
select household_id,
       chore_id,
       case
         when recurrence = 'weekly' then done_date - extract(dow from done_date)::int
         else done_date
       end,
       null,
       completed_at
from ticked
on conflict (chore_id, on_date) do nothing;

-- chores.completed_at is now legacy and is deliberately NOT dropped.
--
-- The migration and the app deploy are not atomic. Between them the old
-- build is live against this schema, and it both reads and writes this
-- column. Dropping it here would take the wall down for the length of a
-- Vercel build. It can go in a later migration once the new build has been
-- running for a while.
comment on column chores.completed_at is
  'Legacy. Superseded by chore_completions; kept so the pre-009 build keeps working through the deploy window. Safe to drop once the new build is established.';


-- ---------------------------------------------------------------------------
-- 5. Who did it last
-- ---------------------------------------------------------------------------
--
-- distinct on is the cheap way to ask this in Postgres and cannot be
-- expressed through PostgREST, so it becomes a view.
--
-- security_invoker makes the view run with the caller's permissions, so the
-- RLS policy on chore_completions still applies. Without it a view is
-- evaluated as its owner and would quietly become a hole straight through
-- the household boundary — the one mistake that would matter here.

create or replace view chore_last_done
with (security_invoker = true) as
select distinct on (cc.chore_id)
  cc.chore_id,
  cc.household_id,
  cc.on_date,
  cc.completed_at,
  cc.completed_by,
  p.display_name as completed_by_name
from chore_completions cc
left join profiles p on p.id = cc.completed_by
order by cc.chore_id, cc.completed_at desc;


-- ---------------------------------------------------------------------------
-- 6. Verify. Run these separately after the migration.
-- ---------------------------------------------------------------------------
--
-- Existing ticks carried across — expect one row per previously-ticked chore,
-- all with a null completed_by:
--
--   select count(*) filter (where completed_by is null) as legacy,
--          count(*) as total
--   from chore_completions;
--
-- The schedule constraint holds. Both of these should fail:
--
--   update chores set due_on = current_date where recurrence = 'weekly';
--   update chores set scheduled_day = 2 where recurrence = 'once';
--
-- And this should succeed, putting a chore on Tuesdays:
--
--   update chores set scheduled_day = 2
--    where recurrence = 'weekly' and title ilike '%dish%';
--
-- The view answers the question this was built for:
--
--   select c.title, l.completed_by_name, l.on_date
--   from chores c left join chore_last_done l on l.chore_id = c.id
--   order by l.completed_at desc nulls last;
