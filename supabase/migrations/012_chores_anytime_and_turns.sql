-- Trellis — slice 13: chores that happen when they happen, and know whose turn
--
-- Run in Supabase AFTER 011_recipe_estimates.sql. Safe to re-run.
--
-- THE PROBLEM THIS FIXES
--
-- Nick and Ed alternate the dishwasher three or four times a week, on no
-- schedule. Trellis could not express that, and the data says so plainly:
-- four chores exist, none has an assignee, and not one has ever been ticked.
-- "Dishwasher" — the most frequent household act there is — has zero
-- completions.
--
-- It is not that nobody tried. It is that ticking it was almost meaningless.
-- A 'weekly' chore has exactly one occurrence per week: 009's on_date scheme
-- keys an unscheduled weekly chore to the week's Sunday, and
-- chore_completions is unique on (chore_id, on_date). So running the
-- dishwasher four times in a week could record one of them, and which one was
-- arbitrary. A control that discards three quarters of what you tell it
-- teaches you to stop using it.
--
-- Two changes.


-- ---------------------------------------------------------------------------
-- 1. A third kind of chore: 'anytime'
-- ---------------------------------------------------------------------------
--
-- 'weekly' is a rhythm ("bins go out Tuesday"). 'once' is an errand. Neither
-- describes the dishwasher, which is *episodic*: it happens when the machine
-- is full, and the only facts worth keeping are when it was last done and by
-- whom.
--
-- An 'anytime' chore has no occurrence tied to a week. Its completions are
-- keyed to the day they happened, so four runs in a week are four rows —
-- which is what the existing unique constraint on (chore_id, on_date) gives
-- for free, and why this needs no change to chore_completions at all. Twice
-- in one day still collapses to one row; that is the same idempotency that
-- stops a double-tap double-counting, and a second dishwasher load before
-- midnight is rare enough to be worth the trade.

alter table chores drop constraint if exists chores_recurrence_check;
alter table chores add  constraint chores_recurrence_check
  check (recurrence in ('weekly', 'once', 'anytime'));

-- An anytime chore takes neither scheduling column. It is not on a weekday
-- and it is not due on a date; asking "which day is the dishwasher" is the
-- category error this whole migration exists to remove.
alter table chores drop constraint if exists chores_schedule_matches_recurrence;
alter table chores add  constraint chores_schedule_matches_recurrence
  check (
    (recurrence = 'weekly'  and due_on is null)
    or (recurrence = 'once' and scheduled_day is null)
    or (recurrence = 'anytime' and scheduled_day is null and due_on is null)
  );


-- ---------------------------------------------------------------------------
-- 2. Turn-taking
-- ---------------------------------------------------------------------------
--
-- `assignee_id` has existed since 001 and is null on all four chores, which
-- is the honest verdict on it: this household does not assign chores, it
-- alternates them. An assignee answers "whose job is this permanently"; the
-- question actually asked over the sink is "whose turn is it".
--
-- That is deliberately NOT a column. Whose turn it is is derivable — it is
-- whoever did not do it last — and storing it would create a second source of
-- truth that drifts from the completion log the first time someone ticks out
-- of order. One boolean says the chore alternates; the log says whose turn it
-- is. See nextTurn() in src/lib/chores.js.
--
-- assignee_id is left alone. It still means "this one is always yours", which
-- is a real thing a household might want, and rotation is the other thing.

alter table chores add column if not exists rotates boolean not null default false;

comment on column chores.rotates is
  'This chore alternates between people. Whose turn it is is derived from chore_completions (whoever did not do it last), never stored — see nextTurn() in src/lib/chores.js.';

-- A chore that alternates but happens on a fixed schedule is fine (alternate
-- who takes the bins out on Tuesdays). No constraint needed between these.


-- ---------------------------------------------------------------------------
-- 3. Move the dishwasher onto the new model
-- ---------------------------------------------------------------------------
--
-- Named explicitly rather than converting every unscheduled weekly chore.
-- "Dust" is also unscheduled and weekly, and it genuinely is weekly — it
-- should keep its checkbox. Guessing which of the two is episodic from the
-- schema alone is not possible, and guessing wrong silently changes how a
-- chore behaves.

update chores
   set recurrence = 'anytime',
       rotates = true,
       scheduled_day = null,
       due_on = null
 where title ilike '%dishwasher%'
   and recurrence <> 'anytime';


-- ---------------------------------------------------------------------------
-- 4. Verify. Run these separately.
-- ---------------------------------------------------------------------------
--
--   select title, recurrence, rotates, scheduled_day, due_on from chores
--    order by sort_order;
--   -- Dishwasher: anytime / true / null / null
--
-- An anytime chore cannot be put on a day (both should fail):
--
--   update chores set scheduled_day = 2 where recurrence = 'anytime';
--   update chores set due_on = current_date where recurrence = 'anytime';
--
-- And the thing that was impossible before — the same chore, done four times
-- in one week, each with its own person:
--
--   select on_date, completed_by from chore_completions
--    where chore_id = (select id from chores where title ilike '%dishwasher%')
--    order by on_date;
