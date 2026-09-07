-- Trellis — slice 4: prepare events for a second, read-only source
--
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Trellis events are created in the app and are editable. Google Calendar
-- events (backlog) are owned by Google and are not. Adding these now means the
-- grid can be built against both cases from the start.

alter table events
  add column if not exists source      text not null default 'trellis',
  add column if not exists external_id text,
  add column if not exists read_only   boolean not null default false;

-- An external event should only ever exist once per source.
create unique index if not exists events_source_external_idx
  on events (source, external_id)
  where external_id is not null;
