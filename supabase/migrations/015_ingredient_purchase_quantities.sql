-- 015 — the four ingredient rows that had a product but no purchase_qty.
--
-- These five rows (one is deliberately left alone, see below) are matched to a
-- real product in the price book and carry no `purchase_qty`, which means they
-- price as nothing. That is not a small cosmetic gap, because `weekPackages`
-- in src/lib/cost.js needs *both* halves — a product to say what a thing costs
-- and a purchase_qty to say how much of it a recipe takes — and drops a row
-- missing either into `unmatched`. So each of these rows is currently absent
-- from three places at once:
--
--   * the week's cost projection, which under-reports by their value,
--   * the shopping list, which never mentions them — Stuffed peppers has been
--     sending someone to the shop without an onion or garlic on the list,
--   * the new price-per-serving figure in the recipe book, which marks the
--     recipe with a "+" and refuses to sort it against fully-costed ones.
--
-- The numbers are not invented. Each is the convention the bank has already
-- settled on for the same product in the same unit, which is the whole reason
-- to fix this in a migration rather than by eye in the dashboard:
--
--   Yellow onions   1 whole onion -> 0.17 of a 3 lb bag.   8 rows already agree.
--   Garlic          4-5 cloves    -> 0.17 of a 3 ct pack.  2 rows already agree.
--   Jasmine rice    2 cups dry    -> 0.17 of an 80 oz bag. 9 rows already agree.
--
-- Two need a word of arithmetic on top of the precedent:
--
--   Stuffed peppers' garlic is 3 cloves rather than 4-5. Still 0.17: the bank
--   prices garlic by the pack and a clove is not a divisible unit of one, so
--   splitting hairs below a pack invents precision the price book does not
--   have.
--
--   Stuffed peppers' rice is "1.5 cups cooked", and every other rice row is
--   measured dry. Rice roughly triples, so that is ~0.5 cups dry; against the
--   bank's own 2 cups dry -> 0.17, that is 0.04 of a bag.
--
-- Deliberately NOT filled:
--
--   Protein Berry Smoothie / Frozen berries, unit "fill cup". There is no
--   quantity recorded and "fill cup" is not a measure anything can be derived
--   from — a cup of a 32 oz bag could be a fifth of it or a third depending on
--   whose cup. That one wants a sentence from Nick, not a guess, and the book
--   goes on saying "no prices yet" for the smoothie until it gets one.
--
-- No provenance row is written, because there is nowhere to write one.
-- `recipe_field_provenance` whitelists *recipe* fields and `purchase_qty` is a
-- column on an ingredient; `recipe_ingredients.normalization_source` describes
-- the normalisation, not the quantity. Worth knowing before a future pass
-- assumes these five numbers came from a person: they came from the bank's own
-- conventions, applied here.
--
-- Guarded on `purchase_qty is null` so a re-run cannot overwrite a number
-- someone has since measured properly.

update recipe_ingredients i
   set purchase_qty = v.qty
  from (values
    -- recipe                      ingredient      purchase_qty
    ('Stuffed peppers',            'Yellow onion',  0.17),
    ('Stuffed peppers',            'Garlic',        0.17),
    ('Stuffed peppers',            'Cooked rice',   0.04),
    ('Asian Beef Udon Stir-Fry',   'Garlic',        0.17)
  ) as v(recipe_title, ingredient_name, qty)
  join recipes r on r.title = v.recipe_title
 where i.recipe_id     = r.id
   and i.name          = v.ingredient_name
   and i.product_id    is not null
   and i.purchase_qty  is null;


-- ---------------------------------------------------------------------------
-- Re-derive cost_confidence for the two recipes this completes
-- ---------------------------------------------------------------------------
--
-- 005 defines the vocabulary: 'receipt' when every ingredient maps to a
-- receipt-confirmed product, 'estimated' when they map to products priced from
-- screenshots, 'unknown' when anything is unmatched or TBD. Asian Beef Udon
-- has read 'unknown' on the strength of these gaps; it still has one genuinely
-- unpriced row (fresh ginger, "to taste", no product), so it stays 'unknown'
-- and stays marked with a "+" in the book. That is correct.
--
-- Stuffed peppers now has no unpriced rows at all, but it touches products
-- priced from a screenshot, so it is 'estimated' — which is what it already
-- said. Nothing changes; this statement exists to make the check explicit
-- rather than assumed.
--
-- **The test is for the negative, and it has to be.** The obvious way to write
-- this is `price_source not like '%receipt-confirmed%'`, and it is wrong,
-- because the two values in the price book are:
--
--   'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'
--   'ALDI website/app screenshot; not receipt-confirmed'
--
-- The negative *contains* the positive as a substring, so that test matches
-- both, no row is ever 'estimated', and every screenshot-derived price gets
-- promoted to receipt-confirmed. The first draft of this migration did exactly
-- that and had to be undone. Match on 'not receipt-confirmed' instead: the
-- claim being made is the weaker one, so test for the weaker one.

update recipes r
   set cost_confidence = case
         when exists (
           select 1 from recipe_ingredients i
            where i.recipe_id = r.id
              and i.product_id is null
              and i.manual_cost_cents is null
         ) then 'unknown'
         when exists (
           select 1 from recipe_ingredients i
             join products p on p.id = i.product_id
            where i.recipe_id = r.id
              and p.price_source like '%not receipt-confirmed%'
         ) then 'estimated'
         else 'receipt'
       end
 where r.title in ('Stuffed peppers', 'Asian Beef Udon Stir-Fry');


-- ---------------------------------------------------------------------------
-- Verify. Run these separately.
-- ---------------------------------------------------------------------------
--
-- No recipe claims 'receipt' — nothing in the bank is fully receipt-priced,
-- so a row here means the substring trap above has bitten again:
--
--   select title, cost_confidence from recipes where cost_confidence = 'receipt';
--
-- Rows with a product and no quantity — should be 1, the smoothie's berries:
--
--   select r.title, i.name, i.unit
--     from recipe_ingredients i join recipes r on r.id = i.recipe_id
--    where i.product_id is not null and i.purchase_qty is null;
--
-- Stuffed peppers should now price completely, at $1.82 a serving against the
-- $1.66+ it showed before — second-cheapest in the book rather than banished
-- to the bottom of it. Asian Beef Udon goes to $4.87+ and keeps the "+",
-- because the ginger is still unpriced:
--
--   select round(sum(i.purchase_qty * after_tax_cents(p.pre_tax_cents,
--                                                     p.tax_rate_bps))) as cents
--     from recipe_ingredients i
--     join recipes r on r.id = i.recipe_id
--     left join products p on p.id = i.product_id
--    where r.title = 'Stuffed peppers';
