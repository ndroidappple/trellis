-- Trellis — slice 12b: estimated times, effort and methods
--
-- 010 deliberately left prep_minutes, total_minutes, the missing cook times
-- and the missing methods null, on the grounds that 008's notes call those
-- Ed's decisions rather than lost facts. Nick has overridden that: fill them
-- with best estimates.
--
-- So this migration writes numbers nobody has timed and methods nobody has
-- written down. That is a deliberate change of policy, not a lapse, and the
-- provenance rows say so — every value here lands as 'ai_enrichment' with a
-- confidence between 0.60 and 0.75, against the 1.00 carried by Ed's own
-- figures. `select * from recipe_field_provenance where confidence < 0.8`
-- is the list of things to check against a real kitchen timer.
--
-- Still not written, because there is genuinely nothing to estimate from:
--
--   Filthy cabbage   retired, zero ingredient rows, zero steps, and no notes
--                    beyond the fact of its retirement. The name is the only
--                    information that exists. Left untouched.
--   Steak salad      conditional, zero ingredient rows. Gets a serving count
--                    and times, since those follow from "a steak salad", but
--                    no method — a method needs ingredients, and inventing
--                    the ingredients of someone else's salad is a different
--                    act from estimating how long a known recipe takes.
--
-- Both need a sentence from Nick or Ed, not another pass.


-- ---------------------------------------------------------------------------
-- 0. Methods become a field provenance can talk about
-- ---------------------------------------------------------------------------
--
-- recipe_field_provenance.field_name is whitelisted, and 'steps' is not on
-- the list — 008 wrote that list for the columns on `recipes` and never
-- imagined enrichment producing a method, because it had decided enrichment
-- never would. The constraint caught this migration on its first run, which
-- is the constraint doing its job.
--
-- Now that three methods are model-written and thirteen are Ed's, this is the
-- single most important distinction in the table: everything else is a label
-- on a dish, but this is the difference between instructions a person tested
-- and instructions a model produced. Adding it.

alter table recipe_field_provenance
  drop constraint if exists recipe_field_provenance_field_known;
alter table recipe_field_provenance
  add  constraint recipe_field_provenance_field_known check (
    field_name in (
      'title', 'description', 'status', 'servings_min', 'servings_max',
      'effort', 'cook_minutes', 'prep_minutes', 'total_minutes',
      'leftover_quality', 'cuisine', 'meal_types', 'tags',
      'source_url', 'image_url', 'notes', 'cost_confidence',
      'steps'
    )
  );


-- ---------------------------------------------------------------------------
-- 1. Times, effort, and servings for the recipes that had none
-- ---------------------------------------------------------------------------
--
-- The estimates assume the batch each recipe currently describes: the twelve
-- "Big-Pot Bowls" really do make 8 servings, and their ingredient quantities
-- say so (3 lb of chicken is 6 oz a head across 8, which is an ordinary
-- portion, not a large one). Where a recipe had NO serving count recorded,
-- it is set to 4-5 generous servings per Nick's instruction — that is the
-- size those ingredient lists actually describe.
--
-- Prep is knife time before the pot goes on. Total is prep + cook rather than
-- true wall clock: for one-pot recipes some chopping genuinely overlaps the
-- simmer, so this errs long. Erring long is the right direction for a number
-- someone reads at 6pm while deciding whether there is time to cook.
--
-- The smoothie keeps a null cook_minutes. The constraint requires minutes > 0
-- when present, so "no cooking" cannot be spelled 0 — and null is the more
-- honest spelling of it anyway.

update recipes r
   set prep_minutes  = case when trellis_may_enrich(r.id, 'prep_minutes')
                            then e.prep  else r.prep_minutes  end,
       total_minutes = case when trellis_may_enrich(r.id, 'total_minutes')
                            then e.total else r.total_minutes end,
       cook_minutes  = case when trellis_may_enrich(r.id, 'cook_minutes')
                            then coalesce(e.cook, r.cook_minutes) else r.cook_minutes end,
       effort        = case when trellis_may_enrich(r.id, 'effort')
                            then coalesce(e.effort, r.effort) else r.effort end,
       servings_min  = case when trellis_may_enrich(r.id, 'servings_min')
                            then coalesce(e.smin, r.servings_min) else r.servings_min end,
       servings_max  = case when trellis_may_enrich(r.id, 'servings_max')
                            then coalesce(e.smax, r.servings_max) else r.servings_max end
  from (values
    -- title                                  prep cook total effort   smin smax
    ('Asian Beef Udon Stir-Fry',                15,   20,  35, 'Easy',    4,   5),
    ('Cajun Chicken & Sausage Rice',            20, null,  70,  null,  null, null),
    ('Chicken Burrito Pot',                     15, null,  60,  null,  null, null),
    ('Creamy Chicken, Broccoli & Rice',         15, null,  60,  null,  null, null),
    ('Korean-Inspired Turkey Rice Bowls',       15, null,  55,  null,  null, null),
    ('Mediterranean Chicken & Chickpea Pot',    15, null,  60,  null,  null, null),
    ('One-Pot Chicken Chickpea Curry',          15, null,  60,  null,  null, null),
    -- No cook time: nothing is cooked. Total is the whole job, which is prep.
    ('Protein Berry Smoothie',                   5, null,   5, 'Easy', null, null),
    ('Salsa Verde Chicken & Rice',              15, null,  60,  null,  null, null),
    ('Steak salad',                             15,   15,  30, 'Easy',    4,   5),
    ('Stuffed peppers',                         25, null,  75,  null,  null, null),
    ('Turkey Chili Mac',                        15, null,  55,  null,  null, null),
    ('Turkey Lentil Stew',                      20, null,  75,  null,  null, null),
    ('Turkey Rosso Pesto Protein Pasta',        10,   25,  35, 'Easy', null, null),
    ('Turkey Taco Rice Pot',                    15, null,  55,  null,  null, null),
    ('Unstuffed Pepper Pot',                    15, null,  55,  null,  null, null),
    ('White Chicken Chili',                     15, null,  60,  null,  null, null)
  ) as e(title, prep, cook, total, effort, smin, smax)
 where r.title = e.title;


-- ---------------------------------------------------------------------------
-- 2. Methods for the recipes that had none
-- ---------------------------------------------------------------------------
--
-- Three of the five step-less recipes have ingredient lists complete enough
-- to write a credible method from. The steps deliberately name ingredients
-- without repeating quantities ("brown the ground turkey", not "brown 3 lb of
-- ground turkey") — amounts live in the ingredient rows, and a method that
-- restates them goes stale the moment a batch size changes.
--
-- Guarded on having no steps at all rather than on step_number, so re-running
-- cannot half-append into a method someone has since written properly.

insert into recipe_steps (recipe_id, household_id, step_number, body)
select r.id, r.household_id, s.step_number, s.body
from recipes r
join (values
  ('Asian Beef Udon Stir-Fry', 1,
   'Whisk the soy sauce, rice vinegar, brown sugar, grated ginger and minced garlic together, add the shaved steak, and leave it to marinate while you prep everything else.'),
  ('Asian Beef Udon Stir-Fry', 2,
   'Get a wok or your widest pan very hot. Sear the steak in batches so it browns instead of steaming, then lift it out and set it aside.'),
  ('Asian Beef Udon Stir-Fry', 3,
   'Add the stir-fry vegetables to the same pan and cook hard for four or five minutes, until the broccoli is bright green and still has bite.'),
  ('Asian Beef Udon Stir-Fry', 4,
   'Add the udon and the sauce from the meal kit, tossing to loosen the noodles and coat everything.'),
  ('Asian Beef Udon Stir-Fry', 5,
   'Return the steak and any juices to the pan, toss for a final minute, and serve.'),

  ('Turkey Rosso Pesto Protein Pasta', 1,
   'Bring a large pot of well-salted water to the boil and cook the protein penne a minute short of the package time. Save a mug of pasta water before draining.'),
  ('Turkey Rosso Pesto Protein Pasta', 2,
   'While the pasta cooks, brown the ground turkey in a wide pan over medium-high heat, breaking it up as it goes.'),
  ('Turkey Rosso Pesto Protein Pasta', 3,
   'Add the diced onion and minced garlic and cook until soft, about five minutes.'),
  ('Turkey Rosso Pesto Protein Pasta', 4,
   'Stir in the rosso pesto with a splash of the pasta water, loosening it into a sauce that coats the back of a spoon.'),
  ('Turkey Rosso Pesto Protein Pasta', 5,
   'Add the spinach a handful at a time, letting each go limp before the next.'),
  ('Turkey Rosso Pesto Protein Pasta', 6,
   'Fold the drained pasta through the sauce, adding more pasta water until it clings rather than sits. Finish with grated parmesan.'),

  ('Protein Berry Smoothie', 1,
   'Put the water into the blender first, then the whey protein, chia seeds and creatine. Liquid at the bottom keeps the powder off the blades.'),
  ('Protein Berry Smoothie', 2,
   'Add the frozen berries on top.'),
  ('Protein Berry Smoothie', 3,
   'Blend until smooth, loosening with more water until it pours the way you like it.')
) as s(title, step_number, body) on s.title = r.title
where not exists (select 1 from recipe_steps x where x.recipe_id = r.id);


-- ---------------------------------------------------------------------------
-- 3. Provenance
-- ---------------------------------------------------------------------------
--
-- Lower confidence than 010's classification work, and deliberately so. A
-- cuisine is a judgement about a recipe that exists; a prep time is a claim
-- about a kitchen nobody stood in. These numbers should lose to the first
-- person who actually times one.

insert into recipe_field_provenance
  (household_id, recipe_id, field_name, source_type, source_reference, confidence)
select r.household_id, r.id, f.field_name, 'ai_enrichment',
       'claude-opus-5 estimate via 011_recipe_estimates.sql', f.confidence
from recipes r
cross join (values
  ('prep_minutes',  0.60),
  ('total_minutes', 0.60),
  ('cook_minutes',  0.60),
  ('effort',        0.75),
  ('servings_min',  0.60),
  ('servings_max',  0.60)
) as f(field_name, confidence)
where trellis_may_enrich(r.id, f.field_name)
  and case f.field_name
        when 'prep_minutes'  then r.prep_minutes  is not null
        when 'total_minutes' then r.total_minutes is not null
        when 'cook_minutes'  then r.cook_minutes  is not null
        when 'effort'        then r.effort        is not null
        when 'servings_min'  then r.servings_min  is not null
        when 'servings_max'  then r.servings_max  is not null
      end
on conflict (recipe_id, field_name) do update
  set source_type      = excluded.source_type,
      source_reference = excluded.source_reference,
      confidence       = excluded.confidence;


-- Steps need their own two statements, and the reason is worth stating.
-- 008 recorded provenance for nine recipe fields and not for methods, so a
-- single "every recipe that has steps" insert here would stamp Ed's thirteen
-- hand-written methods as AI-authored — quietly destroying the distinction
-- this table exists to keep. Ed's are claimed as 'existing' first.

insert into recipe_field_provenance
  (household_id, recipe_id, field_name, source_type, source_reference, confidence)
select r.household_id, r.id, 'steps', 'existing',
       '006_seed_meal_hq.sql — Meal HQ — Master sheet', 1.00
from recipes r
where exists (select 1 from recipe_steps s where s.recipe_id = r.id)
  and r.title not in (
    'Asian Beef Udon Stir-Fry',
    'Turkey Rosso Pesto Protein Pasta',
    'Protein Berry Smoothie'
  )
on conflict (recipe_id, field_name) do nothing;

insert into recipe_field_provenance
  (household_id, recipe_id, field_name, source_type, source_reference, confidence)
select r.household_id, r.id, 'steps', 'ai_enrichment',
       'claude-opus-5 estimate via 011_recipe_estimates.sql', 0.65
from recipes r
where r.title in (
    'Asian Beef Udon Stir-Fry',
    'Turkey Rosso Pesto Protein Pasta',
    'Protein Berry Smoothie'
  )
  and exists (select 1 from recipe_steps s where s.recipe_id = r.id)
  and trellis_may_enrich(r.id, 'steps')
on conflict (recipe_id, field_name) do update
  set source_type      = excluded.source_type,
      source_reference = excluded.source_reference,
      confidence       = excluded.confidence;


-- ---------------------------------------------------------------------------
-- 4. Re-derive status
-- ---------------------------------------------------------------------------
--
-- Three recipes gain a method here, so they leave the worklist. The two with
-- no ingredient rows stay on it, which is the correct answer: what they are
-- missing is a sentence from a person.

update recipes
   set enrichment_status = case
         when not exists (select 1 from recipe_steps s where s.recipe_id = recipes.id)
           then 'needs_review'
         else 'enriched'
       end,
       enriched_at = now();


-- ---------------------------------------------------------------------------
-- 5. Verify. Run these separately.
-- ---------------------------------------------------------------------------
--
--   select count(*) from recipes where prep_minutes  is null;   -- 1 (cabbage)
--   select count(*) from recipes where total_minutes is null;   -- 1 (cabbage)
--   select count(*) from recipes where effort        is null;   -- 1 (cabbage)
--   select count(*) from recipes where servings_min  is null;   -- 1 (cabbage)
--   select count(*) from recipes where enrichment_status = 'needs_review';
--                                                               -- 2
--
-- Nothing violates the sanity rules (this must return 0 rows):
--
--   select title, prep_minutes, cook_minutes, total_minutes from recipes
--    where total_minutes < cook_minutes;
--
-- What to distrust, in one query:
--
--   select r.title, p.field_name, p.confidence
--     from recipe_field_provenance p join recipes r on r.id = p.recipe_id
--    where p.confidence < 0.80 order by r.title, p.field_name;
