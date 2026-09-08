-- Trellis — slice 10: the rich recipe model, and integrity that does not
-- depend on who is writing.
--
-- Run in Supabase AFTER 007_board_settings.sql. Safe to re-run.
--
-- Context for why this migration is shaped the way it is:
--
-- Until now every write to the recipe tables came from one of two places —
-- the seed, or the app under RLS. Both are trustworthy by construction. That
-- is about to stop being true: recipes will arrive from ChatGPT (via the
-- Supabase MCP connector, which runs with *developer* permissions and is
-- therefore above RLS entirely) and later from an /api endpoint of our own.
--
-- So the invariants move into the database, where they hold for every writer.
-- A constraint that lives in an endpoint protects only the callers that use
-- that endpoint. A constraint that lives in Postgres protects the endpoint,
-- the MCP connector, psql, and whatever comes next, identically.
--
-- Three things this migration does, in order of how much they matter:
--
--   1. Integrity  — a recipe cannot be active-but-empty, and a child row
--                   cannot belong to a different household than its parent.
--   2. Provenance — every enriched field records where its value came from,
--                   and a lower-trust source cannot silently overwrite a
--                   higher-trust one.
--   3. Fields     — the actual new columns, which are the easy part.


-- ---------------------------------------------------------------------------
-- 1. Recipe-level fields
-- ---------------------------------------------------------------------------

alter table recipes add column if not exists description   text;
alter table recipes add column if not exists prep_minutes  int;
alter table recipes add column if not exists total_minutes int;
alter table recipes add column if not exists cuisine       text;
alter table recipes add column if not exists meal_types    text[];
alter table recipes add column if not exists tags          text[];
alter table recipes add column if not exists source_url    text;
alter table recipes add column if not exists image_url     text;
alter table recipes add column if not exists image_source  text;

-- Enrichment bookkeeping. A rerun skips rows already marked 'enriched' and
-- can queue the ones it could not resolve as 'needs_review' rather than
-- guessing — the pipeline's exception list is a column, not a spreadsheet.
alter table recipes add column if not exists enrichment_status text not null default 'pending';
alter table recipes add column if not exists enriched_at       timestamptz;


-- ---------------------------------------------------------------------------
-- 2. Search: derived, not enriched
-- ---------------------------------------------------------------------------
--
-- The backlog asks for a `search_keywords` field for AI to populate. Postgres
-- already does this better than an AI can, and for free: a generated tsvector
-- is recomputed on every write, so it can never drift out of step with the
-- recipe the way a stored keyword blob does the first time someone edits a
-- title. It also costs nothing to maintain and needs no provenance, because
-- it isn't a claim about the world — it's a function of columns we already
-- trust.
--
-- Kept to title/description/notes deliberately: every function in a generated
-- column must be IMMUTABLE, and these three are plain text concatenation.

alter table recipes add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'english'::regconfig,
      title || ' ' || coalesce(description, '') || ' ' || coalesce(notes, '')
    )
  ) stored;

create index if not exists recipes_search_idx on recipes using gin (search_vector);
create index if not exists recipes_tags_idx   on recipes using gin (tags);


-- ---------------------------------------------------------------------------
-- 3. Ingredient normalization
-- ---------------------------------------------------------------------------
--
-- The seed already demonstrates the problem this solves. The same price-book
-- product, "Yellow onions", is referenced by two different ingredient names:
-- "Onion" in the pesto pasta and "Yellow onion" in the lentil stew. Where a
-- product_id exists, that product *is* the normalization and nothing more is
-- needed. normalized_name earns its keep for the rows that have no product
-- yet — cupboard spices, the udon marinade — so they can still be grouped for
-- a grocery list before anyone has priced them.
--
-- preparation is split out for the same reason the backlog gives:
-- "2 large yellow onions, diced" is a quantity, a normalized ingredient and a
-- preparation, and only the middle one should decide what you buy.

alter table recipe_ingredients add column if not exists normalized_name     text;
alter table recipe_ingredients add column if not exists ingredient_category text;
alter table recipe_ingredients add column if not exists preparation         text;

-- Ingredients are enriched as one cluster by one actor, always together, so
-- they get a single source column rather than their own provenance table.
-- Recipes get the full treatment below because their fields are written by
-- different actors at different times.
alter table recipe_ingredients add column if not exists normalization_source text;

create index if not exists recipe_ingredients_normalized_idx
  on recipe_ingredients (household_id, normalized_name);


-- ---------------------------------------------------------------------------
-- 4. Value constraints
-- ---------------------------------------------------------------------------
--
-- drop-then-add rather than a `do $$ if not exists $$` block for each: same
-- idempotence, far less noise, and it matches the `drop policy if exists`
-- pattern the earlier migrations already use.
--
-- Every one of these was checked against the seeded data first. Nothing here
-- rejects a row that exists today.

-- CHECK cannot contain a subquery, so array validation goes through an
-- immutable helper. Rejects nulls, empty strings, and anything not already
-- lowercased and trimmed — casing drift ("Italian" / "italian" / "ITALIAN")
-- is exactly what makes an AI-populated tag column useless for filtering.
create or replace function trellis_is_normalized_labels(labels text[])
returns boolean
language sql
immutable
as $$
  select labels is null or not exists (
    select 1 from unnest(labels) as x
    where x is null or x = '' or x <> lower(btrim(x))
  );
$$;

alter table recipes drop constraint if exists recipes_title_not_blank;
alter table recipes add  constraint recipes_title_not_blank
  check (length(btrim(title)) > 0);

alter table recipes drop constraint if exists recipes_servings_sane;
alter table recipes add  constraint recipes_servings_sane
  check (
    (servings_min is null or servings_min > 0)
    and (servings_max is null or servings_max > 0)
    and (servings_min is null or servings_max is null or servings_min <= servings_max)
  );

alter table recipes drop constraint if exists recipes_minutes_sane;
alter table recipes add  constraint recipes_minutes_sane
  check (
    (cook_minutes  is null or cook_minutes  > 0)
    and (prep_minutes  is null or prep_minutes  > 0)
    and (total_minutes is null or total_minutes > 0)
    -- Total is the wall-clock length of the whole recipe, so it cannot be
    -- shorter than the cooking inside it.
    and (total_minutes is null or cook_minutes is null or total_minutes >= cook_minutes)
  );

alter table recipes drop constraint if exists recipes_cuisine_normalized;
alter table recipes add  constraint recipes_cuisine_normalized
  check (cuisine is null or (cuisine <> '' and cuisine = lower(btrim(cuisine))));

alter table recipes drop constraint if exists recipes_tags_normalized;
alter table recipes add  constraint recipes_tags_normalized
  check (trellis_is_normalized_labels(tags));

-- Same domain as meal_plan.slot, so a recipe tagged for a slot can actually
-- be planned into it. A recipe may serve several.
alter table recipes drop constraint if exists recipes_meal_types_known;
alter table recipes add  constraint recipes_meal_types_known
  check (
    meal_types is null
    or (meal_types <@ array['breakfast', 'lunch', 'dinner', 'snack']::text[]
        -- array_length returns NULL for '{}', and a CHECK passes on NULL, so
        -- an empty array would otherwise slip through as "no meal types" in a
        -- second, harder-to-query spelling of null.
        and coalesce(array_length(meal_types, 1), 0) > 0)
  );

alter table recipes drop constraint if exists recipes_urls_are_urls;
alter table recipes add  constraint recipes_urls_are_urls
  check (
    (source_url is null or source_url ~ '^https?://')
    and (image_url is null or image_url ~ '^https?://')
  );

alter table recipes drop constraint if exists recipes_enrichment_status_known;
alter table recipes add  constraint recipes_enrichment_status_known
  check (enrichment_status in ('pending', 'enriched', 'needs_review', 'skipped'));

-- Where an image came from, on the same footing as where a fact came from.
alter table recipes drop constraint if exists recipes_image_source_known;
alter table recipes add  constraint recipes_image_source_known
  check (
    image_source is null
    or image_source in ('recipe_source', 'ai_generated', 'user_uploaded')
  );

-- An image without a stated origin is the thing we are trying to avoid.
alter table recipes drop constraint if exists recipes_image_needs_source;
alter table recipes add  constraint recipes_image_needs_source
  check (image_url is null or image_source is not null);

alter table recipe_ingredients drop constraint if exists recipe_ingredients_qty_sane;
alter table recipe_ingredients add  constraint recipe_ingredients_qty_sane
  check (
    (qty is null or qty > 0)
    and (purchase_qty is null or purchase_qty > 0)
  );

alter table recipe_ingredients drop constraint if exists recipe_ingredients_category_known;
alter table recipe_ingredients add  constraint recipe_ingredients_category_known
  check (
    ingredient_category is null
    or ingredient_category in (
      'produce', 'meat', 'seafood', 'dairy', 'bakery', 'pantry',
      'spice', 'frozen', 'beverage', 'supplement', 'other'
    )
  );

alter table recipe_ingredients drop constraint if exists recipe_ingredients_normalized_lower;
alter table recipe_ingredients add  constraint recipe_ingredients_normalized_lower
  check (
    normalized_name is null
    or (normalized_name <> '' and normalized_name = lower(btrim(normalized_name)))
  );


-- ---------------------------------------------------------------------------
-- 5. Household integrity, enforced by key rather than by trust
-- ---------------------------------------------------------------------------
--
-- Today nothing stops an ingredient row carrying a household_id different
-- from its recipe's. RLS hides the damage from the app but does not prevent
-- it, and a service-role or MCP writer is not subject to RLS at all — which
-- is precisely the writer we are about to add.
--
-- A composite foreign key makes the mismatch unrepresentable. No trigger, no
-- endpoint check, no reliance on the caller getting it right.

alter table recipes drop constraint if exists recipes_id_household_key;
alter table recipes add  constraint recipes_id_household_key unique (id, household_id);

alter table recipe_ingredients drop constraint if exists recipe_ingredients_recipe_id_fkey;
alter table recipe_ingredients drop constraint if exists recipe_ingredients_recipe_household_fkey;
alter table recipe_ingredients add  constraint recipe_ingredients_recipe_household_fkey
  foreign key (recipe_id, household_id)
  references recipes (id, household_id)
  on delete cascade;

alter table recipe_steps drop constraint if exists recipe_steps_recipe_id_fkey;
alter table recipe_steps drop constraint if exists recipe_steps_recipe_household_fkey;
alter table recipe_steps add  constraint recipe_steps_recipe_household_fkey
  foreign key (recipe_id, household_id)
  references recipes (id, household_id)
  on delete cascade;

-- Steps are ordered, and two step 3s is a corrupt method, not a preference.
alter table recipe_steps drop constraint if exists recipe_steps_number_unique;
alter table recipe_steps add  constraint recipe_steps_number_unique
  unique (recipe_id, step_number);

alter table recipe_steps drop constraint if exists recipe_steps_number_positive;
alter table recipe_steps add  constraint recipe_steps_number_positive
  check (step_number > 0);


-- ---------------------------------------------------------------------------
-- 6. An active recipe must have ingredients
-- ---------------------------------------------------------------------------
--
-- This is the rule that catches the most likely AI failure: a plausible
-- recipe row with a title, a cuisine, a cook time and nothing to buy. It
-- would look completely fine in a list and silently contribute $0 to the
-- week's grocery projection.
--
-- It cannot be a CHECK constraint, because it spans two tables. It is a
-- DEFERRABLE constraint trigger instead, so it is evaluated at COMMIT rather
-- than at each statement — otherwise inserting a recipe would fail before its
-- own ingredients had a chance to be inserted.
--
-- Note this passes on today's data by accident of good practice: the only two
-- recipes with no ingredient rows are 'Filthy cabbage' (retired) and
-- 'Steak salad' (conditional). The rule already describes how Ed works.

create or replace function trellis_assert_active_recipe_has_ingredients()
returns trigger
language plpgsql
as $$
declare
  target uuid;
  rec    record;
  n      int;
begin
  -- NEW is unassigned in a DELETE trigger, so TG_OP decides which to read.
  if tg_op = 'DELETE' then
    target := case tg_table_name when 'recipes' then old.id else old.recipe_id end;
  else
    target := case tg_table_name when 'recipes' then new.id else new.recipe_id end;
  end if;

  select * into rec from recipes where id = target;

  -- Recipe went away in the same transaction; nothing left to be wrong.
  if not found then
    return null;
  end if;

  if rec.status <> 'active' then
    return null;
  end if;

  select count(*) into n from recipe_ingredients where recipe_id = target;

  if n = 0 then
    raise exception
      'Recipe "%" is active but has no ingredients. Add ingredient rows, or set status to conditional or retired.',
      rec.title
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists recipes_active_needs_ingredients on recipes;
create constraint trigger recipes_active_needs_ingredients
  after insert or update of status on recipes
  deferrable initially deferred
  for each row execute function trellis_assert_active_recipe_has_ingredients();

drop trigger if exists recipe_ingredients_keep_parent_complete on recipe_ingredients;
create constraint trigger recipe_ingredients_keep_parent_complete
  after delete on recipe_ingredients
  deferrable initially deferred
  for each row execute function trellis_assert_active_recipe_has_ingredients();


-- ---------------------------------------------------------------------------
-- 7. Provenance
-- ---------------------------------------------------------------------------
--
-- One row per (recipe, field), updated in place. The unique key is what makes
-- the enrichment pipeline safe to re-run: a second pass upserts over its own
-- previous answer instead of accumulating a history nobody reads.

create table if not exists recipe_field_provenance (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references household(id) on delete cascade,
  recipe_id        uuid not null,
  field_name       text not null,
  source_type      text not null,
  -- Where specifically: a URL, a migration filename, a model name, a person.
  source_reference text,
  -- 0.00–1.00. Null means the source does not express confidence — a human
  -- typing a value they know is not making a probabilistic claim.
  confidence       numeric(3, 2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint recipe_field_provenance_recipe_fkey
    foreign key (recipe_id, household_id)
    references recipes (id, household_id)
    on delete cascade,

  constraint recipe_field_provenance_unique unique (recipe_id, field_name),

  constraint recipe_field_provenance_source_known check (
    source_type in (
      'existing',           -- was already in Trellis and predates enrichment
      'verified_source',    -- a real recipe source we can point at
      'user_supplied',      -- Nick or Ed typed it
      'ai_enrichment',      -- a model produced it
      'system_calculated',  -- derived from other Trellis data
      'unknown'
    )
  ),

  -- Constrained on purpose. An unconstrained field_name gives you provenance
  -- rows for 'cook_time' and 'cook_minutes' and no way to notice.
  constraint recipe_field_provenance_field_known check (
    field_name in (
      'title', 'description', 'status', 'servings_min', 'servings_max',
      'effort', 'cook_minutes', 'prep_minutes', 'total_minutes',
      'leftover_quality', 'cuisine', 'meal_types', 'tags',
      'source_url', 'image_url', 'notes', 'cost_confidence'
    )
  ),

  constraint recipe_field_provenance_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index if not exists recipe_field_provenance_recipe_idx
  on recipe_field_provenance (recipe_id);

create index if not exists recipe_field_provenance_source_idx
  on recipe_field_provenance (household_id, source_type);

alter table recipe_field_provenance enable row level security;

drop policy if exists recipe_field_provenance_all on recipe_field_provenance;
create policy recipe_field_provenance_all on recipe_field_provenance
  for all using (household_id = current_household_id())
      with check (household_id = current_household_id());

-- Ingredient normalization records its source with the same vocabulary, so
-- "where did this come from" has one answer shape across the schema.
alter table recipe_ingredients drop constraint if exists recipe_ingredients_norm_source_known;
alter table recipe_ingredients add  constraint recipe_ingredients_norm_source_known
  check (
    normalization_source is null
    or normalization_source in (
      'existing', 'verified_source', 'user_supplied',
      'ai_enrichment', 'system_calculated', 'unknown'
    )
  );


-- ---------------------------------------------------------------------------
-- 8. The trust hierarchy, enforced
-- ---------------------------------------------------------------------------
--
-- "AI should not overwrite trusted information simply because it believes
-- another value is more likely." That sentence is only true if something
-- refuses the write. Ranking the sources and rejecting downgrades is what
-- turns it from an intention into a guarantee.
--
-- There is a deliberate escape hatch, because sometimes the human really is
-- wrong and a correction has to land:
--
--   begin;
--   set local trellis.allow_provenance_downgrade = 'on';
--   update recipe_field_provenance set ... ;
--   commit;
--
-- `set local` means it expires at the end of that transaction and cannot be
-- left switched on by accident.

create or replace function trellis_provenance_rank(source_type text)
returns int
language sql
immutable
as $$
  select case source_type
    when 'user_supplied'     then 40
    when 'existing'          then 35
    when 'verified_source'   then 30
    when 'system_calculated' then 25
    when 'ai_enrichment'     then 20
    when 'unknown'           then 10
    else 0
  end;
$$;

create or replace function trellis_guard_provenance_downgrade()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if trellis_provenance_rank(new.source_type) < trellis_provenance_rank(old.source_type)
     and coalesce(current_setting('trellis.allow_provenance_downgrade', true), 'off') <> 'on'
  then
    raise exception
      'Refusing to overwrite % on recipe % : held as %, offered as %. Set trellis.allow_provenance_downgrade if this correction is intended.',
      old.field_name, old.recipe_id, old.source_type, new.source_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists recipe_field_provenance_guard on recipe_field_provenance;
create trigger recipe_field_provenance_guard
  before update on recipe_field_provenance
  for each row execute function trellis_guard_provenance_downgrade();


-- ---------------------------------------------------------------------------
-- 9. Backfill: everything that exists today came from Ed's sheet
-- ---------------------------------------------------------------------------
--
-- Without this the guard above protects nothing — an empty provenance table
-- means every existing field is fair game for the first enrichment pass.
-- Recording the seeded values as 'existing' is what actually stops AI
-- rewriting Ed's cook times.
--
-- Only non-null fields are recorded. A gap stays a gap, and is therefore
-- something enrichment is allowed to fill.

-- The VALUES list deliberately does not reference `r`, so this is a plain
-- CROSS JOIN and needs no LATERAL. The per-field "is this populated?" test
-- lives in the WHERE clause instead, where referencing both sides is
-- unambiguous.
insert into recipe_field_provenance
  (household_id, recipe_id, field_name, source_type, source_reference, confidence)
select r.household_id, r.id, f.field_name, 'existing',
       '006_seed_meal_hq.sql — Meal HQ — Master sheet', 1.00
from recipes r
cross join (values
  ('title'),
  ('status'),
  ('cost_confidence'),
  ('servings_min'),
  ('servings_max'),
  ('effort'),
  ('cook_minutes'),
  ('leftover_quality'),
  ('notes')
) as f(field_name)
where case f.field_name
        when 'servings_min'     then r.servings_min     is not null
        when 'servings_max'     then r.servings_max     is not null
        when 'effort'           then r.effort           is not null
        when 'cook_minutes'     then r.cook_minutes     is not null
        when 'leftover_quality' then r.leftover_quality is not null
        when 'notes'            then r.notes            is not null
        -- title, status and cost_confidence are NOT NULL columns.
        else true
      end
on conflict (recipe_id, field_name) do nothing;

-- Ingredient names likewise predate enrichment.
update recipe_ingredients
   set normalization_source = 'existing'
 where normalization_source is null;


-- ---------------------------------------------------------------------------
-- 10. Verify. Run these separately after the migration.
-- ---------------------------------------------------------------------------
--
-- Expect 18 recipes, and provenance rows only for fields that are populated:
--
--   select count(*) from recipes;
--   select source_type, count(*) from recipe_field_provenance group by 1;
--
-- The enrichment worklist — what is genuinely missing, per recipe. Three
-- active recipes should appear. Asian Beef Udon, Turkey Rosso Pesto and the
-- smoothie are Ed's own, and their gaps are decisions he has not made rather
-- than facts that were lost. Those get filled by asking him, not by a model:
--
--   select title, status,
--          servings_min is null as no_servings,
--          effort       is null as no_effort,
--          cook_minutes is null as no_cook_time,
--          not exists (select 1 from recipe_steps s where s.recipe_id = r.id)
--            as no_steps
--   from recipes r
--   where status = 'active'
--     and (servings_min is null or effort is null or cook_minutes is null
--          or not exists (select 1 from recipe_steps s where s.recipe_id = r.id));
--
-- Confirm the trust guard actually bites (this should raise, not succeed):
--
--   update recipe_field_provenance
--      set source_type = 'ai_enrichment'
--    where field_name = 'cook_minutes'
--    limit 1;
--
-- Confirm the active-recipe rule bites (should raise at commit):
--
--   begin;
--   insert into recipes (household_id, title)
--   select id, 'Constraint test' from household limit 1;
--   commit;
