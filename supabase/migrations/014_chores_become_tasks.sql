-- 014 — chores grow into a general task system.
--
-- The decision this encodes: one table, one row type, one list. Trellis had
-- two candidate homes for tasks — `chores` (recurrence, rotation, a
-- completion log) and a dormant `list_items` row with list='todo' that has
-- never held a single row — plus the option of a third `tasks` table beside
-- them. A separate table models the difference more honestly, because a chore
-- rotates and is never finished while a task is done once and gone. It also
-- means two lists, two panels and two mental models for a household of two.
--
-- So: a task is a chore whose `recurrence` is 'once'. That is not a
-- workaround, it is what 'once' already meant — `due_on` has been the due
-- date since 009, and `chores_schedule_matches_recurrence` already binds it
-- to exactly that recurrence. Nothing below touches that constraint.
--
-- Everything added here is recurrence-agnostic on purpose. A weekly chore can
-- carry a priority and a note as sensibly as a one-off can; only the *date*
-- is specific to a kind, and it already exists.
--
-- The table keeps the name `chores`. Renaming it would touch the completion
-- log, the chore_last_done view, every RLS policy and four constraints to
-- settle a question the UI has already settled differently — the panel has
-- been called "Weekly To Do" since the redesign, so the user-facing noun is
-- already "task" and only the storage still says "chore".

alter table chores
  add column if not exists priority smallint not null default 0,
  add column if not exists notes text,
  add column if not exists starts_on date,
  add column if not exists parent_id uuid references chores(id) on delete cascade;

-- 0 = none. Deliberately not a traffic light: two people sharing a wall do
-- not need four grades of alarm, and the UI only renders anything above 0
-- (the same rule that stops the shopping list printing "x1" on every row).
alter table chores drop constraint if exists chores_priority_range;
alter table chores
  add constraint chores_priority_range check (priority between 0 and 3);

-- A subtask cannot be its own parent. Deeper cycles are not prevented here —
-- Postgres cannot express that in a CHECK — but the UI only ever offers one
-- level of nesting, and `on delete cascade` means a parent taking its
-- children with it is the intended behaviour rather than an orphan risk.
alter table chores drop constraint if exists chores_parent_not_self;
alter table chores
  add constraint chores_parent_not_self check (parent_id is null or parent_id <> id);

-- A start date is "do not show me this yet", so it cannot sensibly fall after
-- the date the thing is due. Only checkable when both exist.
alter table chores drop constraint if exists chores_starts_before_due;
alter table chores
  add constraint chores_starts_before_due
  check (starts_on is null or due_on is null or starts_on <= due_on);

-- The panel reads the whole list every render and groups it in the client, so
-- the only index worth adding is the one the subtask lookup needs.
create index if not exists chores_parent_id_idx on chores (parent_id)
  where parent_id is not null;

-- RLS needs no new policy: every chores policy already funnels through
-- current_household_id(), and these are columns on a table that is already
-- covered. Stated explicitly because "I added a column and forgot the policy"
-- is the failure this project's schema notes exist to prevent — here there is
-- genuinely nothing to add.
