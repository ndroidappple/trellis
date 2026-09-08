-- Trellis — slice 8: board display settings
--
-- Run in Supabase Studio: SQL Editor -> New query -> paste -> Run.
--
-- board_settings holds the per-section display mode for the wall's dock —
-- 'full', 'compact', or 'off' — on the household row so every device
-- (the wall, your phone) reads the same layout. Opened with a long-press
-- on the board rather than a settings button.

alter table household
  add column if not exists board_settings jsonb not null default '{"chores":"full","shopping":"full"}'::jsonb;
