-- Trellis — slice 12: actually running the enrichment 008 built the rails for
--
-- 008 added description, cuisine, tags, meal_types, prep/total minutes,
-- source_url, image_url, the ingredient normalization columns and
-- recipe_field_provenance — and then nothing ever populated any of them.
-- Every one of the 18 recipes still read enrichment_status = 'pending'.
-- This is the pass that fills them.
--
-- Safe to re-run. Every write is gated on trellis_may_enrich(), so a second
-- pass overwrites its own previous answer and refuses to touch anything a
-- human has since corrected.
--
--
-- WHAT THIS DELIBERATELY DOES NOT FILL
--
-- 008's own verification notes say it plainly: "Asian Beef Udon, Turkey Rosso
-- Pesto and the smoothie are Ed's own, and their gaps are decisions he has not
-- made rather than facts that were lost. Those get filled by asking him, not
-- by a model." So:
--
--   * No servings.      Three recipes lack them. A serving count is a fact
--                       about a batch, not a classification.
--   * No effort.        Same. It is Ed's judgement of his own recipe.
--   * No cook_minutes.  Five lack them.
--   * No prep_minutes / total_minutes for ANY recipe. This is the one that
--                       matters most. Nothing in the data says how long prep
--                       takes, the UI renders an estimated minute count
--                       identically to a measured one, and "35 min" that
--                       nobody timed is exactly the silent invention the
--                       provenance system exists to prevent. Left null until
--                       either someone times a recipe or the book learns to
--                       show an estimate as an estimate.
--   * No steps.         Five recipes have none. A fabricated method is a
--                       ruined dinner, and it is the single most confident-
--                       looking thing a model could produce here.
--   * No source_url.    There is nothing to point at. These came off Ed's
--                       Meal HQ sheet, not from publishers.
--
-- What it does fill is the set the backlog sanctions: classification,
-- categorisation, summarisation, ingredient normalisation. Nothing here is a
-- claim about the world that could not be read off the data already present.


-- ---------------------------------------------------------------------------
-- 1. The re-run guard
-- ---------------------------------------------------------------------------
--
-- 008 gave us trellis_provenance_rank and a trigger that refuses a downgrade
-- on UPDATE. That protects a write that is attempted; it does not tell a
-- pipeline which writes to attempt. Without this, re-running enrichment after
-- Nick fixes a description by hand would raise inside the trigger and abort
-- the whole migration — technically correct, operationally useless.
--
-- This asks the question up front instead: is this field currently held by
-- something that outranks a model?

create or replace function trellis_may_enrich(target uuid, field text)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from recipe_field_provenance p
    where p.recipe_id  = target
      and p.field_name = field
      and trellis_provenance_rank(p.source_type)
          > trellis_provenance_rank('ai_enrichment')
  );
$$;


-- ---------------------------------------------------------------------------
-- 2. Recipe-level enrichment
-- ---------------------------------------------------------------------------
--
-- Joined on title rather than id on purpose: ids are generated per project, so
-- a rebuilt Supabase project gets different ones and a migration keyed on them
-- would silently match nothing. Titles are the stable identity here, and step
-- 5 verifies the join actually matched.
--
-- Two recipes appear nowhere below. 'Filthy cabbage' is retired with no
-- ingredients and no notes beyond the fact of its retirement, and 'Steak
-- salad' is conditional with no ingredient rows at all. There is nothing to
-- summarise or classify, so they get no description, cuisine, tags or meal
-- types — only a status in step 4 saying a human needs to look at them.

update recipes r
   set description = case when trellis_may_enrich(r.id, 'description')
                          then e.description else r.description end,
       cuisine     = case when trellis_may_enrich(r.id, 'cuisine')
                          then e.cuisine     else r.cuisine     end,
       tags        = case when trellis_may_enrich(r.id, 'tags')
                          then e.tags        else r.tags        end,
       meal_types  = case when trellis_may_enrich(r.id, 'meal_types')
                          then e.meal_types  else r.meal_types  end
  from (values
    ('Asian Beef Udon Stir-Fry',
     'Shaved steak marinated in soy, ginger and garlic, stir-fried with broccoli and udon from a meal kit.',
     'asian',
     array['beef','noodles','stir-fry','meal-kit'],
     array['dinner']),

    ('Cajun Chicken & Sausage Rice',
     'Chicken and cooked sausage simmered with peppers, onion and jasmine rice under a heavy hand of Cajun seasoning.',
     'cajun',
     array['chicken','rice','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Chicken Burrito Pot',
     'Everything in a burrito except the tortilla: chicken, rice, beans, salsa and corn cooked down in one pot.',
     'tex-mex',
     array['chicken','rice','beans','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Creamy Chicken, Broccoli & Rice',
     'Chicken and rice cooked with broccoli, then finished off the heat with Greek yogurt and cheese.',
     'american',
     array['chicken','rice','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Korean-Inspired Turkey Rice Bowls',
     'Ground turkey with soy, garlic and ginger over rice, piled with cabbage, carrot and edamame.',
     -- The recipe notes say "Korean-inspired, not traditional". Recording it
     -- as 'korean' would launder Ed's own hedge out of the data.
     'korean-inspired',
     array['turkey','rice','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Mediterranean Chicken & Chickpea Pot',
     'Chicken, chickpeas and tomatoes over rice, brightened with lemon and spinach and served with yogurt.',
     'mediterranean',
     array['chicken','rice','beans','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('One-Pot Chicken Chickpea Curry',
     'Chicken, chickpeas and coconut milk simmered with curry powder, with the rice cooking in the same pot.',
     'indian-inspired',
     array['chicken','rice','beans','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Protein Berry Smoothie',
     'Whey, frozen berries, chia and creatine blended with water. One glass, no cooking.',
     null,
     array['no-cook','blender','high-protein'],
     array['breakfast','snack']),

    ('Salsa Verde Chicken & Rice',
     'Chicken and rice cooked in salsa verde with black beans, corn and peppers, finished with cheese.',
     'tex-mex',
     array['chicken','rice','beans','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Stuffed peppers',
     'Bell pepper halves baked with a turkey, bean, rice and tomato filling under shredded cheese.',
     'american',
     array['turkey','rice','beans','baked','leftovers'],
     array['dinner','lunch']),

    ('Turkey Chili Mac',
     'Chili and macaroni in the same pot: ground turkey, beans, two kinds of tomato and protein pasta.',
     'american',
     array['turkey','pasta','beans','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Turkey Lentil Stew',
     'A thick stew of ground turkey, lentils, potato and carrot that freezes and reheats well.',
     'american',
     -- 'freezer-friendly' and 'high-protein' are lifted from this recipe's own
     -- notes, not inferred from the ingredients.
     array['turkey','lentils','stew','one-pot','big-batch','leftovers','freezer-friendly','high-protein'],
     array['dinner','lunch']),

    ('Turkey Rosso Pesto Protein Pasta',
     'Ground turkey and protein penne tossed with red pesto, spinach and parmesan.',
     'italian-inspired',
     -- No 'leftovers' tag: this recipe has no leftover_quality recorded, and
     -- the neighbouring recipes all do. That gap is Ed's to fill.
     array['turkey','pasta','high-protein'],
     array['dinner']),

    ('Turkey Taco Rice Pot',
     'Taco filling and rice cooked together with black beans, tomatoes, corn and peppers.',
     'tex-mex',
     array['turkey','rice','beans','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('Unstuffed Pepper Pot',
     'Stuffed peppers without the stuffing: turkey, rice, peppers and tomato sauce in one pot under cheese.',
     'american',
     array['turkey','rice','one-pot','big-batch','leftovers'],
     array['dinner','lunch']),

    ('White Chicken Chili',
     'Chicken, white beans and green chiles in a broth thickened with yogurt and cheese off the heat.',
     'tex-mex',
     array['chicken','beans','one-pot','big-batch','leftovers'],
     array['dinner','lunch'])
  ) as e(title, description, cuisine, tags, meal_types)
 where r.title = e.title;


-- Provenance for exactly the fields that just took a value. The confidences
-- are not decoration: meal_types is a near-mechanical read off the recipe,
-- while a description is prose a model wrote, and the numbers say so.
insert into recipe_field_provenance
  (household_id, recipe_id, field_name, source_type, source_reference, confidence)
select r.household_id, r.id, f.field_name, 'ai_enrichment',
       'claude-opus-5 via 010_recipe_enrichment_run.sql', f.confidence
from recipes r
cross join (values
  ('description', 0.80),
  ('cuisine',     0.85),
  ('tags',        0.80),
  ('meal_types',  0.90)
) as f(field_name, confidence)
where trellis_may_enrich(r.id, f.field_name)
  and case f.field_name
        when 'description' then r.description is not null
        when 'cuisine'     then r.cuisine     is not null
        when 'tags'        then r.tags        is not null
        when 'meal_types'  then r.meal_types  is not null
      end
on conflict (recipe_id, field_name) do update
  set source_type      = excluded.source_type,
      source_reference = excluded.source_reference,
      confidence       = excluded.confidence;


-- ---------------------------------------------------------------------------
-- 3. Ingredient normalisation
-- ---------------------------------------------------------------------------
--
-- The point of normalized_name is to let two recipes asking for the same
-- grocery concept collapse to one line on the shopping list. 61 distinct
-- ingredient names across 127 rows, and the duplicates are exactly the ones
-- you would expect: "Bell pepper" / "Bell peppers", "Chicken breast" /
-- "Chicken breast or thighs", "Protein pasta" / "Protein penne".
--
-- Where merging is a judgement call, this UNDER-merges. "Onion" stays separate
-- from "Yellow onion" and "Cooked rice" from "Jasmine rice". Over-merging
-- silently drops something you needed to buy; under-merging puts two similar
-- lines on a list a human is reading anyway. Only one of those failures is
-- recoverable in the shop.
--
-- A NOTE ON THE GATE. 008's backfill set normalization_source = 'existing' on
-- all 127 rows, on the reasoning that ingredient *names* predate enrichment.
-- But the column documents the *normalisation*, and those columns were all
-- null. Read strictly by rank, 'existing' (35) outranks 'ai_enrichment' (20)
-- and no ingredient could ever be normalised at all. That is not what 008
-- intended — its own comment says "a gap stays a gap, and is therefore
-- something enrichment is allowed to fill". So the gate here is the gap
-- itself: normalized_name is null. Rows a human has since normalised are
-- protected by that same test.

update recipe_ingredients i
   set normalized_name      = m.normalized_name,
       ingredient_category  = m.ingredient_category,
       normalization_source = 'ai_enrichment'
  from (values
    ('Beef bulgogi udon meal kit',   'beef bulgogi udon meal kit', 'other'),
    ('Bell pepper',                  'bell pepper',                'produce'),
    ('Bell peppers',                 'bell pepper',                'produce'),
    ('Black beans',                  'black beans',                'pantry'),
    ('Black or pinto beans',         'black beans',                'pantry'),
    ('Broccoli florets',             'broccoli',                   'produce'),
    ('Broccoli stir-fry vegetables', 'broccoli stir-fry vegetables','produce'),
    ('Brown or green lentils',       'brown lentils',              'pantry'),
    ('Brown sugar',                  'brown sugar',                'pantry'),
    ('Cajun seasoning',              'cajun seasoning',            'spice'),
    ('Carrots',                      'carrot',                     'produce'),
    ('Chia seeds',                   'chia seeds',                 'pantry'),
    ('Chicken breast',               'chicken breast',             'meat'),
    ('Chicken breast or thighs',     'chicken breast',             'meat'),
    ('Chicken broth',                'chicken broth',              'pantry'),
    ('Chicken sausage',              'chicken sausage',            'meat'),
    ('Chickpeas',                    'chickpeas',                  'pantry'),
    ('Chili powder',                 'chili powder',               'spice'),
    ('Chili seasoning',              'chili seasoning',            'spice'),
    ('Cooked rice',                  'rice',                       'pantry'),
    ('Corn',                         'corn',                       'pantry'),
    ('Creatine',                     'creatine',                   'supplement'),
    ('Crushed tomatoes',             'crushed tomatoes',           'pantry'),
    ('Cumin',                        'cumin',                      'spice'),
    ('Curry powder',                 'curry powder',               'spice'),
    ('Diced green chiles',           'diced green chiles',         'pantry'),
    ('Diced tomatoes',               'diced tomatoes',             'pantry'),
    ('Edamame',                      'edamame',                    'frozen'),
    ('Fresh ginger',                 'ginger',                     'produce'),
    ('Frozen berries',               'frozen berries',             'frozen'),
    ('Frozen mixed vegetables',      'frozen mixed vegetables',    'frozen'),
    ('Garlic',                       'garlic',                     'produce'),
    ('Ginger',                       'ginger',                     'produce'),
    ('Greek yogurt',                 'greek yogurt',               'dairy'),
    ('Ground turkey',                'ground turkey',              'meat'),
    ('Jasmine rice',                 'jasmine rice',               'pantry'),
    ('Kidney or black beans',        'kidney beans',               'pantry'),
    ('Lemon',                        'lemon',                      'produce'),
    ('Light coconut milk',           'coconut milk',               'pantry'),
    ('Onion',                        'onion',                      'produce'),
    ('Parmesan',                     'parmesan',                   'dairy'),
    ('Pinto beans',                  'pinto beans',                'pantry'),
    ('Potatoes',                     'potato',                     'produce'),
    ('Protein pasta',                'protein pasta',              'pantry'),
    ('Protein penne',                'protein pasta',              'pantry'),
    ('Rice vinegar',                 'rice vinegar',               'pantry'),
    ('Rosso pesto',                  'rosso pesto',                'pantry'),
    ('Salsa',                        'salsa',                      'pantry'),
    ('Salsa verde',                  'salsa verde',                'pantry'),
    ('Shaved steak',                 'shaved steak',               'meat'),
    ('Shredded cabbage',             'cabbage',                    'produce'),
    ('Shredded cheese',              'shredded cheese',            'dairy'),
    ('Soy sauce',                    'soy sauce',                  'pantry'),
    ('Spinach',                      'spinach',                    'produce'),
    ('Taco seasoning',               'taco seasoning',             'spice'),
    ('Tomato sauce',                 'tomato sauce',               'pantry'),
    ('Water',                        'water',                      'other'),
    ('Whey protein',                 'whey protein',               'supplement'),
    ('White beans',                  'white beans',                'pantry'),
    ('Yellow onion',                 'yellow onion',               'produce')
  ) as m(name, normalized_name, ingredient_category)
 where i.name = m.name
   and i.normalized_name is null;


-- Preparation is extracted, never invented. Every value below is already
-- written down in the ingredient's own name or notes — this only moves it
-- into a column where something can query it. Ingredients whose notes say
-- nothing about preparation ("Fully cooked", "Pantry spice blend", "Stir in
-- off heat" — a product fact, a shopping fact and a serving instruction
-- respectively) are left alone rather than stretched into one.

update recipe_ingredients set preparation = 'halved lengthwise'
 where preparation is null and name = 'Bell peppers'   and notes ilike 'Halve lengthwise%';

update recipe_ingredients set preparation = 'shredded'
 where preparation is null and name = 'Carrots'        and notes ilike 'Shredded%';

update recipe_ingredients set preparation = 'shredded'
 where preparation is null and name = 'Shredded cabbage';

update recipe_ingredients set preparation = 'minced'
 where preparation is null and name = 'Garlic'         and notes ilike 'Minced%';

update recipe_ingredients set preparation = 'drained and rinsed'
 where preparation is null and name = 'Pinto beans'    and notes ilike 'Drain and rinse%';

update recipe_ingredients set preparation = 'zested and juiced'
 where preparation is null and name = 'Lemon'          and notes ilike 'Zest and juice%';

update recipe_ingredients set preparation = 'marinated'
 where preparation is null and name = 'Shaved steak'   and notes ilike 'Marinate%';

update recipe_ingredients set preparation = 'cooked'
 where preparation is null and name = 'Cooked rice';


-- ---------------------------------------------------------------------------
-- 4. Status
-- ---------------------------------------------------------------------------
--
-- 'needs_review' is not a failure state, it is the worklist. These five are
-- the recipes where what is missing cannot be supplied by a model:
--
--   Asian Beef Udon Stir-Fry   no steps, no servings, no cook time
--   Turkey Rosso Pesto Pasta   no steps, no effort, no cook time
--   Protein Berry Smoothie     no steps
--   Filthy cabbage             retired, no ingredients, nothing recorded
--   Steak salad                conditional, no ingredient rows
--
-- The recipe book's "Needs work" filter finds exactly this set.

update recipes
   set enrichment_status = case
         when not exists (select 1 from recipe_steps s where s.recipe_id = recipes.id)
           then 'needs_review'
         else 'enriched'
       end,
       enriched_at = now();


-- ---------------------------------------------------------------------------
-- 5. Verify. Run these separately after the migration.
-- ---------------------------------------------------------------------------
--
-- Every title in step 2 must have matched a row. 16 expected; anything less
-- means a title was edited and this migration quietly did nothing for it:
--
--   select count(*) from recipes where description is not null;   -- 16
--   select count(*) from recipes where cuisine     is not null;   -- 15
--   select count(*) from recipes where tags        is not null;   -- 16
--   select count(*) from recipes where meal_types  is not null;   -- 16
--
-- Nothing invented:
--
--   select count(*) from recipes where prep_minutes  is not null; -- 0
--   select count(*) from recipes where total_minutes is not null; -- 0
--   select count(*) from recipes where source_url    is not null; -- 0
--
-- Every ingredient normalised, and the merges that make it worthwhile:
--
--   select count(*) from recipe_ingredients where normalized_name is null;  -- 0
--   select normalized_name, count(*) from recipe_ingredients
--    group by 1 having count(*) > 1 order by 2 desc;
--
-- Provenance is complete and honest about itself:
--
--   select source_type, count(*) from recipe_field_provenance group by 1;
--
-- The guard still bites (should raise, not succeed):
--
--   update recipe_field_provenance set source_type = 'ai_enrichment'
--    where field_name = 'cook_minutes';
--
-- And the re-run is a genuine no-op on anything a human has claimed:
--
--   update recipe_field_provenance
--      set source_type = 'user_supplied' where field_name = 'description';
--   -- re-running this migration must now leave those descriptions untouched.
