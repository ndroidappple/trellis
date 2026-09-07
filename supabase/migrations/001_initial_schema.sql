-- Trellis — slice 1: schema, row-level security, auth wiring
-- Run this in Supabase Studio: SQL Editor -> New query -> paste -> Run.
--
-- BEFORE RUNNING: edit the `allowed` array in handle_new_user() near the
-- bottom to hold your and Ed's real email addresses, lowercase.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists household (
  id                uuid primary key default gen_random_uuid(),
  name              text not null default 'Home',
  enabled_sections  jsonb not null default '["calendar","chores","lists","meals"]'::jsonb,
  created_at        timestamptz not null default now()
);

-- One profile per signed-in person, keyed to Supabase's auth.users table.
-- No profile row means no access to anything. This is the security boundary.
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references household(id) on delete cascade,
  display_name  text not null,
  color         text not null default '#6b8f71',
  created_at    timestamptz not null default now()
);

create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  owner_id      uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists chores (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  title         text not null,
  assignee_id   uuid references profiles(id) on delete set null,
  recurrence    text not null default 'weekly',
  completed_at  timestamptz,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists list_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  list          text not null check (list in ('shopping', 'todo')),
  body          text not null,
  checked       boolean not null default false,
  added_by      uuid references profiles(id) on delete set null,
  source        text not null default 'manual',
  created_at    timestamptz not null default now()
);

create index if not exists events_household_starts_idx on events (household_id, starts_at);
create index if not exists chores_household_idx        on chores (household_id);
create index if not exists list_items_household_idx    on list_items (household_id, list);

-- ---------------------------------------------------------------------------
-- Seed the single household
-- ---------------------------------------------------------------------------

insert into household (name)
select 'Trellis'
where not exists (select 1 from household);

-- ---------------------------------------------------------------------------
-- Helper: which household does the current signed-in user belong to?
-- ---------------------------------------------------------------------------

create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Every policy funnels through current_household_id(). A request with no
-- profile row returns null there, which matches no rows, which means the
-- anon key on its own can read and write precisely nothing.
-- ---------------------------------------------------------------------------

alter table household   enable row level security;
alter table profiles    enable row level security;
alter table events      enable row level security;
alter table chores      enable row level security;
alter table list_items  enable row level security;

drop policy if exists household_read   on household;
drop policy if exists household_update on household;

create policy household_read on household
  for select using (id = current_household_id());

create policy household_update on household
  for update using (id = current_household_id())
           with check (id = current_household_id());

drop policy if exists profiles_read       on profiles;
drop policy if exists profiles_update_own on profiles;

create policy profiles_read on profiles
  for select using (household_id = current_household_id());

create policy profiles_update_own on profiles
  for update using (id = auth.uid())
           with check (id = auth.uid());

drop policy if exists events_all on events;
create policy events_all on events
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

drop policy if exists chores_all on chores;
create policy chores_all on chores
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

drop policy if exists list_items_all on list_items;
create policy list_items_all on list_items
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

-- ---------------------------------------------------------------------------
-- Signup allowlist
--
-- Supabase lets anyone request a magic link. This trigger decides who
-- actually becomes a member of the household. Everyone else authenticates
-- successfully and then finds an empty, permission-denied app.
--
-- >>> EDIT THE TWO EMAIL ADDRESSES BELOW. <<<
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hh      uuid;
  allowed text[] := array[
    'nickszambelan01@gmail.com',
    'theperezproject0912@gmail.com'
  ];
begin
  if not (lower(new.email) = any (allowed)) then
    return new;
  end if;

  select id into hh from household order by created_at limit 1;

  insert into profiles (id, household_id, display_name)
  values (new.id, hh, initcap(split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Realtime — this is what makes the wall update without a refresh
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table events;
alter publication supabase_realtime add table chores;
alter publication supabase_realtime add table list_items;
