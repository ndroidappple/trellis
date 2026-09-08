-- Trellis — slice 7: recipes, meal plan, and weekly cost projection
--
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Shaped after Ed's "Meal HQ — Master" sheet, which already stores ingredients
-- normalized one row per recipe-ingredient pair. This keeps that shape rather
-- than flattening it into a text blob, because the shopping-list push depends
-- on being able to query ingredients independently of their recipe.
--
-- Money is integer cents everywhere. Never floats for currency.

-- ---------------------------------------------------------------------------
-- Budget lives on the household
-- ---------------------------------------------------------------------------

alter table household
  add column if not exists weekly_budget_cents int not null default 12000;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table if not exists recipes (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references household(id) on delete cascade,
  title          text not null,
  status         text not null default 'active'
                 check (status in ('active', 'retired', 'conditional')),
  servings_min   int,
  servings_max   int,
  effort         text check (effort in ('Easy', 'Medium', 'Hard')),
  cook_minutes   int,
  leftover_quality text,
  -- Checkout cost: what you'd pay buying every package the recipe calls for.
  -- Overstates a week's real spend when recipes share ingredients. That
  -- limitation is surfaced in the UI rather than hidden.
  est_cost_cents int,
  cost_confidence text not null default 'estimated'
                 check (cost_confidence in ('receipt', 'estimated', 'unknown')),
  notes          text,
  source         text not null default 'meal_hq',
  created_at     timestamptz not null default now()
);

create table if not exists recipe_ingredients (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references recipes(id) on delete cascade,
  household_id      uuid not null references household(id) on delete cascade,
  name              text not null,
  preferred_product text,
  -- Null quantity is legitimate: Ed's sheet has genuine "TBD" rows. Better to
  -- carry the gap than invent a number.
  qty               numeric,
  unit              text,
  purchase_qty      numeric,
  purchase_unit     text,
  est_cost_cents    int,
  notes             text,
  sort_order        int not null default 0
);

create table if not exists recipe_steps (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references recipes(id) on delete cascade,
  household_id uuid not null references household(id) on delete cascade,
  step_number  int not null,
  body         text not null
);

-- ---------------------------------------------------------------------------
-- Weekly staples — a standing cost that lands in every week's projection
-- ---------------------------------------------------------------------------

create table if not exists staples (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references household(id) on delete cascade,
  item                 text not null,
  weekly_qty           numeric not null default 1,
  unit                 text,
  preferred_store      text,
  included             boolean not null default true,
  after_tax_unit_cents int not null default 0,
  sort_order           int not null default 0
);

-- ---------------------------------------------------------------------------
-- Meal plan
-- ---------------------------------------------------------------------------

create table if not exists meal_plan (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  on_date      date not null,
  slot         text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id    uuid references recipes(id) on delete set null,
  -- Free text for meals that aren't saved recipes: "Easy / pantry or freezer".
  dish         text,
  -- Ed's week is three cook nights and four leftover nights. Leftovers cost
  -- nothing. Without this flag every projection roughly doubles.
  is_leftover  boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, on_date, slot)
);

create index if not exists meal_plan_date_idx on meal_plan (household_id, on_date);
create index if not exists recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);
create index if not exists recipe_steps_recipe_idx on recipe_steps (recipe_id, step_number);

-- ---------------------------------------------------------------------------
-- Row-level security — same household funnel as everything else
-- ---------------------------------------------------------------------------

alter table recipes            enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps       enable row level security;
alter table staples            enable row level security;
alter table meal_plan          enable row level security;

drop policy if exists recipes_all on recipes;
create policy recipes_all on recipes
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

drop policy if exists recipe_ingredients_all on recipe_ingredients;
create policy recipe_ingredients_all on recipe_ingredients
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

drop policy if exists recipe_steps_all on recipe_steps;
create policy recipe_steps_all on recipe_steps
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

drop policy if exists staples_all on staples;
create policy staples_all on staples
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

drop policy if exists meal_plan_all on meal_plan;
create policy meal_plan_all on meal_plan
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table meal_plan;
alter publication supabase_realtime add table recipes;
