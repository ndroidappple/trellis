-- 013 — the shopping list learns what aisle a thing is in, and how many.
--
-- Two problems, one shape.
--
-- 1. The list was a flat alphabetical grid. Alphabetical makes a duplicate
--    obvious, which is what it was chosen for, but it is not how anyone walks
--    a shop: it puts the yoghurt between the yeast and the ziti. 010 already
--    categorised all 127 ingredient rows, so the aisle was sitting in the
--    database the whole time — groceryLines simply had nowhere to put it.
--    `cost.js` still carried a comment saying nothing populated
--    ingredient_category; that stopped being true at 010 and the comment
--    outlived the fact.
--
-- 2. Quantity lived inside the item's text as a "×2" suffix. That made the
--    label the source of truth for a number, so "Ground turkey" and
--    "Ground turkey ×2" were different items to the dedupe in
--    `pendingGroceries` — adding a second turkey week produced a second row
--    rather than a bigger number. It also meant the UI could not style the
--    count differently from the name, because they were one string.
--
-- Both columns are nullable / defaulted, so nothing that writes to
-- list_items today has to change to keep working.

alter table list_items
  add column if not exists category text,
  add column if not exists qty numeric not null default 1;

-- Same vocabulary as recipe_ingredients.ingredient_category (008/010), on
-- purpose: a grocery line's aisle is copied from the ingredient it came from,
-- and two spellings of "produce" would silently split an aisle in two.
alter table list_items
  drop constraint if exists list_items_category_known;

alter table list_items
  add constraint list_items_category_known
  check (
    category is null or category = any (array[
      'produce', 'meat', 'seafood', 'dairy', 'bakery',
      'pantry', 'spice', 'frozen', 'beverage', 'supplement', 'other'
    ])
  );

alter table list_items
  drop constraint if exists list_items_qty_sane;

alter table list_items
  add constraint list_items_qty_sane check (qty > 0);

-- Lift the count out of the text and into the column, for the rows that
-- already carry it. Anchored to the end of the string and requiring the
-- separator, so an item legitimately named "Vitamin D3 x 2000 IU" is not
-- quietly renamed — that pattern has a unit after the number and does not
-- match. Runs before anything reads qty, and is idempotent: once the suffix
-- is gone the regexp stops matching.
update list_items
   set qty  = greatest(1, (regexp_match(body, '[x×]\s*(\d+)\s*$'))[1]::numeric),
       body = btrim(regexp_replace(body, '\s*[x×]\s*\d+\s*$', ''))
 where body ~ '\s*[x×]\s*\d+\s*$'
   and btrim(regexp_replace(body, '\s*[x×]\s*\d+\s*$', '')) <> '';

-- Staples are bought every week regardless of what is cooked, so they never
-- pass through an ingredient row and never had an aisle to inherit. The
-- column lets them sit in the right part of the list instead of collecting
-- at the bottom under "Other".
alter table staples
  add column if not exists category text;

alter table staples
  drop constraint if exists staples_category_known;

alter table staples
  add constraint staples_category_known
  check (
    category is null or category = any (array[
      'produce', 'meat', 'seafood', 'dairy', 'bakery',
      'pantry', 'spice', 'frozen', 'beverage', 'supplement', 'other'
    ])
  );

-- The four staples this household actually has are all refrigerated dairy or
-- eggs. Scoped by name rather than blanket-set, so a staple added later does
-- not silently inherit an aisle nobody chose for it.
update staples
   set category = 'dairy'
 where category is null
   and (item ilike '%egg%' or item ilike '%yogurt%' or item ilike '%milk%');

-- Backfill the aisle for grocery rows already on the list, by matching the
-- item text back to the product it came from and taking the commonest
-- category among the ingredients that use that product. Hand-typed rows match
-- nothing and stay null, which is correct — nobody said what aisle they are
-- in, and guessing would be worse than the "Anything else" group.
with product_aisle as (
  select p.id,
         lower(btrim(p.name)) as name_key,
         mode() within group (order by ri.ingredient_category) as category
    from products p
    join recipe_ingredients ri on ri.product_id = p.id
   where ri.ingredient_category is not null
   group by p.id, p.name
)
update list_items li
   set category = pa.category
  from product_aisle pa
 where li.category is null
   and li.list = 'shopping'
   and lower(btrim(li.body)) = pa.name_key;

-- And the staples already sitting on the list, by name.
update list_items li
   set category = s.category
  from staples s
 where li.category is null
   and li.list = 'shopping'
   and s.category is not null
   and lower(btrim(li.body)) = lower(btrim(s.item));
