-- Trellis — Feature #19: the sync job's write path
--
-- events_source_external_owner_idx (016) is a partial unique index
-- (`where external_id is not null`). Postgres requires an ON CONFLICT
-- clause to repeat that same predicate to match a partial index — plain
-- `.upsert()` from supabase-js has no way to express that, so the sync
-- Edge Function calls this instead of upserting directly.
--
-- security definer, granted to service_role only: this is the sync job's
-- write path and nobody else's. hidden_at is deliberately absent from the
-- UPDATE SET — same shape as trellis_may_enrich guarding a user-supplied
-- recipe field from a re-enrichment pass (008_recipe_enrichment.sql). A
-- hidden event still gets its title/time refreshed by every sync; it just
-- never has hidden_at cleared by one.

create or replace function upsert_google_event(
  p_household_id uuid,
  p_owner_id uuid,
  p_external_id text,
  p_title text,
  p_starts_at timestamptz,
  p_all_day boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into events (household_id, owner_id, source, external_id, title, starts_at, all_day, read_only)
  values (p_household_id, p_owner_id, 'google', p_external_id, p_title, p_starts_at, p_all_day, true)
  on conflict (source, external_id, owner_id) where external_id is not null
  do update set
    title        = excluded.title,
    starts_at    = excluded.starts_at,
    all_day      = excluded.all_day,
    household_id = excluded.household_id;
$$;

revoke all on function upsert_google_event(uuid, uuid, text, text, timestamptz, boolean) from public;
grant execute on function upsert_google_event(uuid, uuid, text, text, timestamptz, boolean) to service_role;
