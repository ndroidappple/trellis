-- Trellis — slice 7b: price book, and cost becomes derived
--
-- Run in Supabase AFTER 004_recipes.sql.
--
-- Trellis is now the system of record for recipes and costing, so a recipe's
-- cost can no longer be a number someone typed. It is computed from the
-- products its ingredients reference. Change a product's price once and every
-- recipe reprices.
--
-- Two costs fall out of this, and they answer different questions:
--
--   consumed cost  — sum of (purchase_qty x unit price) across the week.
--                    Additive. What the food you actually eat is worth.
--
--   checkout cost  — group by product, sum the fractional packages, round each
--                    product UP to whole packages, then price it. What you
--                    actually hand over at the register. This is the number the
--                    budget projection uses.
--
-- The rounding is why two recipes each using half a turkey package cost one
-- package, not two.

-- ---------------------------------------------------------------------------
-- Products — the price book
-- ---------------------------------------------------------------------------

create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references household(id) on delete cascade,
  name              text not null,
  brand             text,
  store             text,
  package_size      text,
  package_unit      text,
  pre_tax_cents     int not null default 0,
  -- Basis points: 150 = 1.50%. Integers avoid the rounding drift you get
  -- storing 0.015 as a float and multiplying it a few hundred times.
  tax_rate_bps      int not null default 0,
  tax_category      text,
  price_captured_on date,
  price_source      text,
  created_at        timestamptz not null default now()
);

-- After-tax price, computed once and consistently rather than in three places
-- in the frontend. Rounds half up to the cent.
create or replace function after_tax_cents(pre_tax int, bps int)
returns int
language sql
immutable
as $$
  select (pre_tax + round(pre_tax * bps / 10000.0))::int;
$$;

create index if not exists products_household_name_idx on products (household_id, name);

alter table products enable row level security;

drop policy if exists products_all on products;
create policy products_all on products
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

-- ---------------------------------------------------------------------------
-- Ingredients now point at products
-- ---------------------------------------------------------------------------

alter table recipe_ingredients
  add column if not exists product_id uuid references products(id) on delete set null;

-- Cost is derived from the product, so the stored copy goes. Kept as a
-- nullable fallback for ingredients with no product match yet — pantry spices,
-- and the marinade rows Ed has genuinely marked TBD.
alter table recipe_ingredients
  rename column est_cost_cents to manual_cost_cents;

create index if not exists recipe_ingredients_product_idx
  on recipe_ingredients (product_id);

-- ---------------------------------------------------------------------------
-- Recipe cost is no longer stored
-- ---------------------------------------------------------------------------

alter table recipes drop column if exists est_cost_cents;

-- cost_confidence stays, but is now derived on import rather than typed:
--   'receipt'   — every ingredient maps to a receipt-confirmed product
--   'estimated' — maps to products priced from app/website screenshots
--   'unknown'   — has unmatched or TBD ingredients
-- The wall marks a projection built from 'unknown' rows so a guess never
-- renders as though it were measured.

-- ---------------------------------------------------------------------------
-- Staples reference products too, rather than carrying their own prices
-- ---------------------------------------------------------------------------

alter table staples
  add column if not exists product_id uuid references products(id) on delete set null;

alter table staples
  rename column after_tax_unit_cents to manual_unit_cents;
