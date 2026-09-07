-- Trellis — slice 5: chores
--
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Two kinds of chore:
--   'weekly' — resets every Monday. Done-ness is derived by comparing
--              completed_at against the start of the current week, so nothing
--              needs to run on a schedule to clear them.
--   'once'   — stays checked until deleted.

alter table chores
  drop constraint if exists chores_recurrence_check;

alter table chores
  add constraint chores_recurrence_check
  check (recurrence in ('weekly', 'once'));

update chores set recurrence = 'weekly' where recurrence not in ('weekly', 'once');

create index if not exists chores_household_order_idx
  on chores (household_id, sort_order, created_at);
