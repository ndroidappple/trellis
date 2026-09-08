-- Trellis - slice 7: seed from the "Meal HQ - Master" Google Sheet
--
-- Run in Supabase AFTER 004_recipes.sql and 005_price_book.sql.
-- Generated, not hand-typed. Safe to re-run: it clears the seeded rows first.
--
-- Snapshot taken September 2026. Trellis is the system of record from this
-- point on; the sheet's Recipe Bank is no longer the place recipes are edited.
--
-- All ALDI items carry tax code B at 1.50% (150 basis points), confirmed by
-- receipt. Prices marked 'app' came from website screenshots rather than a
-- receipt, so they are directionally right but not confirmed.

begin;

-- Idempotent: wipe previously seeded rows so this can be re-run safely.
delete from recipe_ingredients where recipe_id in (select id from recipes where source = 'meal_hq');
delete from recipe_steps       where recipe_id in (select id from recipes where source = 'meal_hq');
delete from recipes            where source = 'meal_hq';
delete from staples;
delete from products;

update household set weekly_budget_cents = 12000;


-- Price book: 66 products

insert into products (household_id, name, brand, store, package_size, package_unit,
                      pre_tax_cents, tax_rate_bps, tax_category, price_captured_on, price_source)
select h.id, v.* from (select id from household order by created_at limit 1) h,
(values
  ('Large eggs', 'Golden Grade A Large White Eggs', 'ALDI', '12 ct', 'carton', 166, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Greek yogurt tub', 'Friendly Farms Nonfat Plain Greek Yogurt', 'ALDI', '32 oz', 'tub', 279, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Greek yogurt cups', 'Friendly Farms Vanilla Protein Blended Nonfat Greek Yogurt Cups', 'ALDI', '4 x 5.3 oz', '4-pack', 369, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Ultra-filtered milk', 'Friendly Farms Lactose Free 2% Reduced Fat Ultra Filtered Milk', 'ALDI', '59 fl oz', 'carton', 399, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Breaded chicken breast', null, 'ALDI', null, 'package', 799, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Frozen berry medley', 'Season''s Choice Frozen Berry Medley', 'ALDI', '32 oz', 'bag', 729, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Chunk tuna in water', null, 'ALDI', null, 'can', 95, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Pinto beans', 'ALDI Pinto Beans', 'ALDI', '15.5 oz', 'can', 85, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Seedless lemons', null, 'ALDI', '1 lb', 'bag', 289, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Parsley', null, 'ALDI', null, 'each', 95, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Baby carrots', null, 'ALDI', null, 'package', 129, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Pure & Simple bars', null, 'ALDI', null, 'box', 349, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Protein chewy bars', null, 'ALDI', null, 'box', 245, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Spaghetti', null, 'ALDI', null, 'package', 189, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Organic creamy peanut butter', null, 'ALDI', null, 'jar', 385, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Avocados', null, 'ALDI', null, 'each', 59, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Argentine shrimp', null, 'ALDI', null, 'package', 999, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Sliced sourdough', null, 'ALDI', null, 'loaf', 349, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Bananas', null, 'ALDI', 'weighted', 'lb', 49, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Peaches', null, 'ALDI', null, 'package', 278, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Red grapes', null, 'ALDI', 'weighted', 'lb', 129, 150, 'ALDI code B', '2026-08-24'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Multi-colored peppers', null, 'ALDI', '3 ct', 'pack', 269, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Rosso pesto sauce', 'Priano Rosso Pesto Sauce', 'ALDI', '6.7 oz', 'jar', 245, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Protein penne pasta', 'Reggano Plant Based Protein Penne Pasta', 'ALDI', '14.5 oz', 'box', 195, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('85/15 ground turkey', 'Kirkwood USDA Fresh Ground Turkey 85% Lean 15% Fat', 'ALDI', '48 oz / 3 lb', 'package', 799, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Spinach', 'Little Salad Bar Spinach', 'ALDI', '8 oz', 'bag', 189, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Parmesan cheese', 'Emporium Selection Parmesan Cheese Wedge', 'ALDI', '8 oz', 'wedge', 439, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Garlic', 'Fresh Garlic', 'ALDI', '3 ct', 'pack', 159, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Yellow onions', 'Yellow Onions', 'ALDI', '3 lb', 'bag', 239, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Zero net carb wraps', 'L''oven Fresh Original Zero Net Carbs Wraps', 'ALDI', '6 wraps / 7.8 oz', 'pack', 249, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Shredded Mexican cheese', 'Happy Farms Shredded Mexican Cheese', 'ALDI', '12 oz', 'bag', 279, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Diced tomatoes', 'Happy Harvest Diced Tomatoes', 'ALDI', '14.5 oz', 'can', 89, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Tomato paste', 'Happy Harvest Tomato Paste', 'ALDI', '6 oz', 'can', 86, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Tomato sauce', 'Happy Harvest Tomato Sauce', 'ALDI', '8 oz', 'can', 47, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Jasmine rice', 'Earthly Grains Jasmine Rice', 'ALDI', '80 oz / 5 lb', 'bag', 629, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Frozen broccoli stir fry', 'Season''s Choice Steamable Frozen Broccoli Stir Fry', 'ALDI', '12 oz', 'bag', 159, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Shaved steak', 'Old Neighborhood USDA Beef Shaved Steak', 'ALDI', '14 oz', 'package', 645, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Beef bulgogi udon meal kit', 'Pulmuone Beef Bulgogi Udon Meal Kit', 'ALDI', '24.07 oz', 'kit', 929, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Green onions', 'Fresh Green Onions', 'ALDI', '5.5 oz', 'bunch', 105, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Classic coleslaw mix', 'Little Salad Bar Classic Coleslaw', 'ALDI', '14 oz', 'bag', 189, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Sweet corn', 'Happy Harvest Whole Kernel Golden Sweet Corn', 'ALDI', '15.25 oz', 'can', 78, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Verde salsa', 'Specially Selected Mild Roasted Verde Salsa', 'ALDI', '16 oz', 'jar', 389, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Boneless skinless chicken thighs', 'Kirkwood Fresh Boneless Skinless Chicken Thighs', 'ALDI', 'variable, ~1.85 lb typical', 'lb', 359, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Boneless skinless chicken breasts', 'Kirkwood Boneless Skinless Chicken Breast Fillets Family Pack', 'ALDI', 'variable, ~4.2 lb typical', 'lb', 229, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Chicken broth', 'Chef''s Cupboard Chicken Broth', 'ALDI', '32 oz', 'carton', 125, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Shredded mozzarella', 'Simply Nature Shredded Organic Mozzarella Cheese', 'ALDI', '6 oz', 'bag', 279, 150, 'ALDI code B', '2026-08-26'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Chorizo', null, 'ALDI', null, 'package', 319, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Black Angus chuck roast', 'Black Angus', 'ALDI', 'variable, rate not shown', 'package', 1538, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Limes', null, 'ALDI', null, 'package', 245, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Beef broth', null, 'ALDI', null, 'carton', 125, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Queso Chihuahua', null, 'ALDI', null, 'package', 1095, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Cilantro', null, 'ALDI', null, 'bunch', 89, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Corn tortillas', null, 'ALDI', null, 'package', 65, 150, 'ALDI code B', '2026-08-27'::date, 'ALDI Store #3, 4500 N Broadway Chicago; receipt-confirmed'),
  ('Shelled edamame', 'Season''s Choice Steamable Shelled Edamame', 'ALDI', '16 oz', 'bag', 275, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Black beans', 'ALDI Black Beans', 'ALDI', '15 oz', 'can', 95, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Chickpeas', 'Simply Nature Organic Chickpeas', 'ALDI', '15.5 oz', 'can', 125, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Red kidney beans', 'Simply Nature USDA Organic Red Kidney Beans', 'ALDI', '15.5 oz', 'can', 109, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Great Northern beans', 'Dakota''s Pride Great Northern Beans', 'ALDI', '15.5 oz', 'can', 95, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Mild Italian chicken sausage', 'Never Any! Mild Italian Chicken Sausage', 'ALDI', '12 oz', 'package', 329, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Crushed tomatoes', 'Happy Harvest Crushed Tomatoes', 'ALDI', '28 oz', 'can', 165, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Unsweetened coconut milk', 'ALDI Unsweetened Coconut Milk', 'ALDI', '13.66 oz', 'can', 175, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Frozen broccoli florets', 'Season''s Choice Steamable Frozen Broccoli Florets', 'ALDI', '12 oz', 'bag', 125, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Frozen mixed vegetables', 'Season''s Choice Steamable Frozen Mixed Vegetable', 'ALDI', '12 oz', 'bag', 109, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Chopped green chiles', 'Pueblo Lindo Chopped Green Chiles', 'ALDI', '4 oz', 'can', 95, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Green lentils', 'Dakota''s Pride Green Lentils', 'ALDI', '16 oz', 'bag', 155, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed'),
  ('Russet potatoes', 'Baking Potatoes', 'ALDI', '5 lb', 'bag', 409, 150, 'ALDI code B', '2026-08-29'::date, 'ALDI website/app screenshot; not receipt-confirmed')
) as v(name, brand, store, package_size, package_unit, pre_tax_cents,
       tax_rate_bps, tax_category, price_captured_on, price_source);


-- Recipe bank: 18 recipes

insert into recipes (household_id, title, status, servings_min, servings_max,
                     effort, cook_minutes, leftover_quality, cost_confidence, notes, source)
select h.id, v.* from (select id from household order by created_at limit 1) h,
(values
  ('Filthy cabbage', 'retired', null::int, null::int, null, null::int, null, 'unknown', 'Retired. Excluded from weekly planning unless specifically requested.', 'meal_hq'),
  ('Stuffed peppers', 'active', 6::int, 6::int, 'Medium', 50::int, 'Excellent', 'estimated', 'House recipe. Rice, onion and garlic consumed-cost left approximate rather than invented.', 'meal_hq'),
  ('Steak salad', 'conditional', null::int, null::int, null, null::int, null, 'unknown', 'Conditional: use when steak is on sale at Jewel. No standing ALDI steak price. No ingredient rows in source.', 'meal_hq'),
  ('Turkey Rosso Pesto Protein Pasta', 'active', 6::int, 8::int, null, null::int, null, 'estimated', 'Defined batch. Typical yield 6-8 servings.', 'meal_hq'),
  ('Protein Berry Smoothie', 'active', 1::int, 1::int, 'Easy', null::int, 'N/A', 'unknown', 'Whey, chia and creatine are cupboard/supplement items with no prices captured.', 'meal_hq'),
  ('Asian Beef Udon Stir-Fry', 'active', null::int, null::int, 'Easy', null::int, 'Good', 'unknown', 'Working name. Marinade quantities still TBD in the source sheet.', 'meal_hq'),
  ('Salsa Verde Chicken & Rice', 'active', 8::int, 8::int, 'Easy', 45::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Finish bowls with cheese, avocado, cilantro or Greek yogurt.', 'meal_hq'),
  ('Turkey Taco Rice Pot', 'active', 8::int, 8::int, 'Easy', 40::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Serve as bowls or repurpose in wraps and nachos.', 'meal_hq'),
  ('Mediterranean Chicken & Chickpea Pot', 'active', 8::int, 8::int, 'Easy', 45::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Add cucumber and Greek-yogurt sauce when serving.', 'meal_hq'),
  ('Korean-Inspired Turkey Rice Bowls', 'active', 8::int, 8::int, 'Easy', 40::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Korean-inspired, not traditional.', 'meal_hq'),
  ('Cajun Chicken & Sausage Rice', 'active', 8::int, 8::int, 'Medium', 50::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Add hot sauce at the table.', 'meal_hq'),
  ('Chicken Burrito Pot', 'active', 8::int, 8::int, 'Easy', 45::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Leftovers work as bowls, wraps, quesadillas or nachos.', 'meal_hq'),
  ('Turkey Chili Mac', 'active', 8::int, 8::int, 'Easy', 40::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Add cheese or Greek yogurt when serving.', 'meal_hq'),
  ('Creamy Chicken, Broccoli & Rice', 'active', 8::int, 8::int, 'Easy', 45::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Stir yogurt in off heat to keep it smooth.', 'meal_hq'),
  ('One-Pot Chicken Chickpea Curry', 'active', 8::int, 8::int, 'Easy', 45::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Rice cooks in the same pot.', 'meal_hq'),
  ('Unstuffed Pepper Pot', 'active', 8::int, 8::int, 'Easy', 40::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Stuffed pepper flavours without stuffing or baking individual peppers.', 'meal_hq'),
  ('White Chicken Chili', 'active', 8::int, 8::int, 'Easy', 45::int, 'Excellent', 'estimated', 'Big-Pot Bowls. Finish with Greek yogurt, cheese, lime or cilantro.', 'meal_hq'),
  ('Turkey Lentil Stew', 'active', 8::int, 8::int, 'Easy', 55::int, 'Excellent', 'estimated', 'Big-Pot Bowls. High-protein, high-fibre, freezer-friendly.', 'meal_hq')
) as v(title, status, servings_min, servings_max, effort, cook_minutes,
       leftover_quality, cost_confidence, notes, source);


-- Ingredients: 127 rows across 16 recipes.

-- product_id is null where the source has no priced product: cupboard spices,
-- and the marinade rows Ed marked TBD. Those show as unpriced rather than free.

insert into recipe_ingredients (household_id, recipe_id, product_id, name,
       preferred_product, qty, unit, purchase_qty, purchase_unit, manual_cost_cents, notes, sort_order)
select h.id,
       (select id from recipes  where title = v.recipe_title limit 1),
       (select id from products where name  = v.product_name  limit 1),
       v.name, v.product_name, v.qty, v.unit, v.purchase_qty, v.purchase_unit,
       v.manual_cost_cents, v.notes, v.sort_order
from (select id from household order by created_at limit 1) h,
(values
  ('Turkey Rosso Pesto Protein Pasta', '85/15 ground turkey', 'Ground turkey', 48::numeric, 'oz', 1::numeric, '48 oz package', null::int, 'Uses entire 3 lb package', 0),
  ('Turkey Rosso Pesto Protein Pasta', 'Protein penne pasta', 'Protein penne', 14.5::numeric, 'oz', 1::numeric, '14.5 oz box', null::int, 'Uses entire box', 1),
  ('Turkey Rosso Pesto Protein Pasta', 'Rosso pesto sauce', 'Rosso pesto', 13.4::numeric, 'oz', 2::numeric, '6.7 oz jars', null::int, 'Uses 2 full jars', 2),
  ('Turkey Rosso Pesto Protein Pasta', 'Yellow onions', 'Onion', 1::numeric, 'whole', 0.33::numeric, '3 lb bag', null::int, 'Remaining onions become cupboard inventory', 3),
  ('Turkey Rosso Pesto Protein Pasta', 'Garlic', 'Garlic', 1::numeric, 'bulb', 0.33::numeric, '3-count pack', null::int, 'Remaining 2 bulbs become cupboard inventory', 4),
  ('Turkey Rosso Pesto Protein Pasta', 'Parmesan cheese', 'Parmesan', 2::numeric, 'oz', 0.25::numeric, '8 oz wedge', null::int, 'About 1/4 wedge; ~6 oz carries into cupboard', 5),
  ('Turkey Rosso Pesto Protein Pasta', 'Spinach', 'Spinach', 8::numeric, 'oz', 1::numeric, '8 oz bag', null::int, 'Uses the entire bag', 6),
  ('Protein Berry Smoothie', null, 'Whey protein', 1::numeric, 'scoop', null::numeric, null, null::int, 'Brand, package and price TBD in source', 0),
  ('Protein Berry Smoothie', null, 'Chia seeds', 1::numeric, 'tbsp', null::numeric, null, null::int, 'Brand, package and price TBD in source', 1),
  ('Protein Berry Smoothie', 'Frozen berry medley', 'Frozen berries', null::numeric, 'fill cup', null::numeric, '32 oz bag', null::int, 'Per-smoothie share unknown until real bag usage is tracked', 2),
  ('Protein Berry Smoothie', null, 'Creatine', 1::numeric, 'scoop', null::numeric, null, null::int, 'Supplement, costed only when restocking', 3),
  ('Protein Berry Smoothie', null, 'Water', null::numeric, 'as needed', null::numeric, null, 0::int, 'Negligible', 4),
  ('Stuffed peppers', 'Multi-colored peppers', 'Bell peppers', 3::numeric, 'whole', 1::numeric, '3-count pack', null::int, 'Halve lengthwise for 6 pepper boats', 0),
  ('Stuffed peppers', '85/15 ground turkey', 'Ground turkey', 24::numeric, 'oz', 0.5::numeric, '48 oz package', null::int, 'Remaining 1.5 lb becomes cupboard/freezer inventory', 1),
  ('Stuffed peppers', 'Pinto beans', 'Pinto beans', 1::numeric, 'can', 1::numeric, '15.5 oz can', null::int, 'Drain and rinse', 2),
  ('Stuffed peppers', 'Jasmine rice', 'Cooked rice', 1.5::numeric, 'cups cooked', null::numeric, '80 oz bag', null::int, '~1/2 cup dry. Consumed share left approximate in source', 3),
  ('Stuffed peppers', 'Yellow onions', 'Yellow onion', 1::numeric, 'medium', null::numeric, '3 lb bag', null::int, null, 4),
  ('Stuffed peppers', 'Garlic', 'Garlic', 3::numeric, 'cloves', null::numeric, '3-count pack', null::int, 'Minced', 5),
  ('Stuffed peppers', 'Diced tomatoes', 'Diced tomatoes', 1::numeric, 'can', 1::numeric, '14.5 oz can', null::int, 'Full 14.5 oz can', 6),
  ('Stuffed peppers', 'Tomato sauce', 'Tomato sauce', 8::numeric, 'oz', 1::numeric, '8 oz can', null::int, 'Full 8 oz can', 7),
  ('Stuffed peppers', 'Shredded Mexican cheese', 'Shredded cheese', 4::numeric, 'oz', 0.33::numeric, '12 oz bag', null::int, '~8 oz remains for later meals', 8),
  ('Stuffed peppers', null, 'Chili powder', 1.5::numeric, 'tsp', null::numeric, null, 0::int, 'Cupboard spice', 9),
  ('Stuffed peppers', null, 'Cumin', 1::numeric, 'tsp', null::numeric, null, 0::int, 'Cupboard spice', 10),
  ('Asian Beef Udon Stir-Fry', 'Beef bulgogi udon meal kit', 'Beef bulgogi udon meal kit', 1::numeric, 'kit', 1::numeric, '24.07 oz kit', null::int, 'Uses 1 full package', 0),
  ('Asian Beef Udon Stir-Fry', 'Shaved steak', 'Shaved steak', 14::numeric, 'oz', 1::numeric, '14 oz package', null::int, 'Marinate before stir-frying', 1),
  ('Asian Beef Udon Stir-Fry', 'Frozen broccoli stir fry', 'Broccoli stir-fry vegetables', 24::numeric, 'oz', 2::numeric, '12 oz bags', null::int, 'Uses 2 full bags', 2),
  ('Asian Beef Udon Stir-Fry', null, 'Fresh ginger', null::numeric, 'to taste', null::numeric, '8 oz package', null::int, 'Marinade; amount TBD in source', 3),
  ('Asian Beef Udon Stir-Fry', 'Garlic', 'Garlic', null::numeric, 'cloves', null::numeric, '3-count pack', null::int, 'Marinade; amount TBD in source', 4),
  ('Asian Beef Udon Stir-Fry', null, 'Soy sauce', null::numeric, 'tbsp', null::numeric, null, 0::int, 'Marinade; cupboard assumption', 5),
  ('Asian Beef Udon Stir-Fry', null, 'Rice vinegar', null::numeric, 'tbsp', null::numeric, null, 0::int, 'Marinade; cupboard assumption', 6),
  ('Asian Beef Udon Stir-Fry', null, 'Brown sugar', null::numeric, 'tbsp', null::numeric, null, 0::int, 'Marinade; cupboard assumption', 7),
  ('Salsa Verde Chicken & Rice', 'Boneless skinless chicken breasts', 'Chicken breast or thighs', 48::numeric, 'oz', 3::numeric, 'lb', null::int, null, 0),
  ('Salsa Verde Chicken & Rice', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('Salsa Verde Chicken & Rice', 'Black beans', 'Black beans', 2::numeric, 'cans', 2::numeric, '15 oz can', null::int, null, 2),
  ('Salsa Verde Chicken & Rice', 'Sweet corn', 'Corn', 1.5::numeric, 'cups', 1::numeric, '15.25 oz can', null::int, null, 3),
  ('Salsa Verde Chicken & Rice', 'Multi-colored peppers', 'Bell peppers', 3::numeric, 'whole', 1::numeric, '3-count pack', null::int, null, 4),
  ('Salsa Verde Chicken & Rice', 'Verde salsa', 'Salsa verde', 2::numeric, 'jars', 2::numeric, '16 oz jar', null::int, null, 5),
  ('Salsa Verde Chicken & Rice', 'Chicken broth', 'Chicken broth', 4::numeric, 'cups', 1::numeric, '32 oz carton', null::int, null, 6),
  ('Salsa Verde Chicken & Rice', 'Shredded Mexican cheese', 'Shredded cheese', 6::numeric, 'oz', 0.5::numeric, '12 oz bag', null::int, null, 7),
  ('Turkey Taco Rice Pot', '85/15 ground turkey', 'Ground turkey', 48::numeric, 'oz', 1::numeric, '48 oz package', null::int, null, 0),
  ('Turkey Taco Rice Pot', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('Turkey Taco Rice Pot', 'Black beans', 'Black beans', 2::numeric, 'cans', 2::numeric, '15 oz can', null::int, null, 2),
  ('Turkey Taco Rice Pot', 'Diced tomatoes', 'Diced tomatoes', 2::numeric, 'cans', 2::numeric, '14.5 oz can', null::int, null, 3),
  ('Turkey Taco Rice Pot', 'Sweet corn', 'Corn', 1.5::numeric, 'cups', 1::numeric, '15.25 oz can', null::int, null, 4),
  ('Turkey Taco Rice Pot', 'Multi-colored peppers', 'Bell peppers', 3::numeric, 'whole', 1::numeric, '3-count pack', null::int, null, 5),
  ('Turkey Taco Rice Pot', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 6),
  ('Turkey Taco Rice Pot', null, 'Taco seasoning', 3::numeric, 'tbsp', null::numeric, null, 0::int, 'Cupboard spice blend', 7),
  ('Mediterranean Chicken & Chickpea Pot', 'Boneless skinless chicken breasts', 'Chicken breast or thighs', 48::numeric, 'oz', 3::numeric, 'lb', null::int, null, 0),
  ('Mediterranean Chicken & Chickpea Pot', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('Mediterranean Chicken & Chickpea Pot', 'Chickpeas', 'Chickpeas', 2::numeric, 'cans', 2::numeric, '15.5 oz can', null::int, null, 2),
  ('Mediterranean Chicken & Chickpea Pot', 'Diced tomatoes', 'Diced tomatoes', 1::numeric, 'can', 1::numeric, '14.5 oz can', null::int, null, 3),
  ('Mediterranean Chicken & Chickpea Pot', 'Spinach', 'Spinach', 8::numeric, 'oz', 1::numeric, '8 oz bag', null::int, null, 4),
  ('Mediterranean Chicken & Chickpea Pot', 'Seedless lemons', 'Lemon', 2::numeric, 'whole', 0.5::numeric, '1 lb bag', null::int, 'Zest and juice', 5),
  ('Mediterranean Chicken & Chickpea Pot', 'Chicken broth', 'Chicken broth', 4::numeric, 'cups', 1::numeric, '32 oz carton', null::int, null, 6),
  ('Mediterranean Chicken & Chickpea Pot', 'Greek yogurt tub', 'Greek yogurt', 1.5::numeric, 'cups', 0.375::numeric, '32 oz tub', null::int, 'Serving sauce', 7),
  ('Korean-Inspired Turkey Rice Bowls', '85/15 ground turkey', 'Ground turkey', 48::numeric, 'oz', 1::numeric, '48 oz package', null::int, null, 0),
  ('Korean-Inspired Turkey Rice Bowls', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('Korean-Inspired Turkey Rice Bowls', 'Classic coleslaw mix', 'Shredded cabbage', 6::numeric, 'cups', 1::numeric, '14 oz bag', null::int, 'Green cabbage or slaw mix', 2),
  ('Korean-Inspired Turkey Rice Bowls', 'Baby carrots', 'Carrots', 2::numeric, 'cups', 1::numeric, 'package', null::int, 'Shredded', 3),
  ('Korean-Inspired Turkey Rice Bowls', 'Shelled edamame', 'Edamame', 2::numeric, 'cups', 1::numeric, '16 oz bag', null::int, null, 4),
  ('Korean-Inspired Turkey Rice Bowls', null, 'Soy sauce', 0.5::numeric, 'cup', null::numeric, null, 0::int, 'Cupboard', 5),
  ('Korean-Inspired Turkey Rice Bowls', 'Garlic', 'Garlic', 5::numeric, 'cloves', 0.17::numeric, '3-count pack', null::int, null, 6),
  ('Korean-Inspired Turkey Rice Bowls', null, 'Ginger', 2::numeric, 'tbsp', null::numeric, null, 0::int, 'Cupboard', 7),
  ('Cajun Chicken & Sausage Rice', 'Boneless skinless chicken breasts', 'Chicken breast or thighs', 32::numeric, 'oz', 2::numeric, 'lb', null::int, null, 0),
  ('Cajun Chicken & Sausage Rice', 'Mild Italian chicken sausage', 'Chicken sausage', 12::numeric, 'oz', 1::numeric, '12 oz package', null::int, 'Fully cooked', 1),
  ('Cajun Chicken & Sausage Rice', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 2),
  ('Cajun Chicken & Sausage Rice', 'Multi-colored peppers', 'Bell peppers', 3::numeric, 'whole', 1::numeric, '3-count pack', null::int, null, 3),
  ('Cajun Chicken & Sausage Rice', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 4),
  ('Cajun Chicken & Sausage Rice', 'Diced tomatoes', 'Diced tomatoes', 1::numeric, 'can', 1::numeric, '14.5 oz can', null::int, null, 5),
  ('Cajun Chicken & Sausage Rice', 'Chicken broth', 'Chicken broth', 4::numeric, 'cups', 1::numeric, '32 oz carton', null::int, null, 6),
  ('Cajun Chicken & Sausage Rice', null, 'Cajun seasoning', 2::numeric, 'tbsp', null::numeric, null, 0::int, 'Cupboard spice blend', 7),
  ('Chicken Burrito Pot', 'Boneless skinless chicken breasts', 'Chicken breast or thighs', 48::numeric, 'oz', 3::numeric, 'lb', null::int, null, 0),
  ('Chicken Burrito Pot', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('Chicken Burrito Pot', 'Black beans', 'Black or pinto beans', 2::numeric, 'cans', 2::numeric, '15 oz can', null::int, null, 2),
  ('Chicken Burrito Pot', 'Verde salsa', 'Salsa', 2::numeric, 'cups', 1::numeric, '16 oz jar', null::int, 'Preferred salsa', 3),
  ('Chicken Burrito Pot', 'Multi-colored peppers', 'Bell peppers', 3::numeric, 'whole', 1::numeric, '3-count pack', null::int, null, 4),
  ('Chicken Burrito Pot', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 5),
  ('Chicken Burrito Pot', 'Sweet corn', 'Corn', 1.5::numeric, 'cups', 1::numeric, '15.25 oz can', null::int, null, 6),
  ('Chicken Burrito Pot', 'Chicken broth', 'Chicken broth', 3::numeric, 'cups', 1::numeric, '32 oz carton', null::int, null, 7),
  ('Turkey Chili Mac', '85/15 ground turkey', 'Ground turkey', 48::numeric, 'oz', 1::numeric, '48 oz package', null::int, null, 0),
  ('Turkey Chili Mac', 'Protein penne pasta', 'Protein pasta', 14.5::numeric, 'oz', 1::numeric, '14.5 oz box', null::int, null, 1),
  ('Turkey Chili Mac', 'Red kidney beans', 'Kidney or black beans', 2::numeric, 'cans', 2::numeric, '15.5 oz can', null::int, null, 2),
  ('Turkey Chili Mac', 'Crushed tomatoes', 'Crushed tomatoes', 28::numeric, 'oz', 1::numeric, '28 oz can', null::int, null, 3),
  ('Turkey Chili Mac', 'Diced tomatoes', 'Diced tomatoes', 1::numeric, 'can', 1::numeric, '14.5 oz can', null::int, null, 4),
  ('Turkey Chili Mac', 'Multi-colored peppers', 'Bell pepper', 2::numeric, 'whole', 0.67::numeric, '3-count pack', null::int, null, 5),
  ('Turkey Chili Mac', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 6),
  ('Turkey Chili Mac', null, 'Chili seasoning', 3::numeric, 'tbsp', null::numeric, null, 0::int, 'Chili powder and cumin, cupboard', 7),
  ('Creamy Chicken, Broccoli & Rice', 'Boneless skinless chicken breasts', 'Chicken breast', 48::numeric, 'oz', 3::numeric, 'lb', null::int, null, 0),
  ('Creamy Chicken, Broccoli & Rice', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('Creamy Chicken, Broccoli & Rice', 'Frozen broccoli florets', 'Broccoli florets', 6::numeric, 'cups', 2::numeric, '12 oz bag', null::int, 'Fresh or frozen', 2),
  ('Creamy Chicken, Broccoli & Rice', 'Chicken broth', 'Chicken broth', 4::numeric, 'cups', 1::numeric, '32 oz carton', null::int, null, 3),
  ('Creamy Chicken, Broccoli & Rice', 'Greek yogurt tub', 'Greek yogurt', 1.5::numeric, 'cups', 0.375::numeric, '32 oz tub', null::int, 'Stir in off heat', 4),
  ('Creamy Chicken, Broccoli & Rice', 'Shredded Mexican cheese', 'Shredded cheese', 6::numeric, 'oz', 0.5::numeric, '12 oz bag', null::int, null, 5),
  ('Creamy Chicken, Broccoli & Rice', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 6),
  ('Creamy Chicken, Broccoli & Rice', 'Garlic', 'Garlic', 4::numeric, 'cloves', 0.17::numeric, '3-count pack', null::int, null, 7),
  ('One-Pot Chicken Chickpea Curry', 'Boneless skinless chicken breasts', 'Chicken breast or thighs', 48::numeric, 'oz', 3::numeric, 'lb', null::int, null, 0),
  ('One-Pot Chicken Chickpea Curry', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('One-Pot Chicken Chickpea Curry', 'Chickpeas', 'Chickpeas', 2::numeric, 'cans', 2::numeric, '15.5 oz can', null::int, null, 2),
  ('One-Pot Chicken Chickpea Curry', 'Diced tomatoes', 'Diced tomatoes', 1::numeric, 'can', 1::numeric, '14.5 oz can', null::int, null, 3),
  ('One-Pot Chicken Chickpea Curry', 'Unsweetened coconut milk', 'Light coconut milk', 2::numeric, 'cans', 2::numeric, '13.66 oz can', null::int, null, 4),
  ('One-Pot Chicken Chickpea Curry', 'Frozen mixed vegetables', 'Frozen mixed vegetables', 4::numeric, 'cups', 2::numeric, '12 oz bag', null::int, null, 5),
  ('One-Pot Chicken Chickpea Curry', null, 'Curry powder', 2::numeric, 'tbsp', null::numeric, null, 0::int, 'Cupboard spice blend', 6),
  ('One-Pot Chicken Chickpea Curry', 'Chicken broth', 'Chicken broth', 2::numeric, 'cups', 0.5::numeric, '32 oz carton', null::int, null, 7),
  ('Unstuffed Pepper Pot', '85/15 ground turkey', 'Ground turkey', 48::numeric, 'oz', 1::numeric, '48 oz package', null::int, null, 0),
  ('Unstuffed Pepper Pot', 'Jasmine rice', 'Jasmine rice', 2::numeric, 'cups dry', 0.17::numeric, '80 oz bag', null::int, null, 1),
  ('Unstuffed Pepper Pot', 'Multi-colored peppers', 'Bell peppers', 4::numeric, 'whole', 1.33::numeric, '3-count pack', null::int, null, 2),
  ('Unstuffed Pepper Pot', 'Diced tomatoes', 'Diced tomatoes', 2::numeric, 'cans', 2::numeric, '14.5 oz can', null::int, null, 3),
  ('Unstuffed Pepper Pot', 'Tomato sauce', 'Tomato sauce', 15::numeric, 'oz', 2::numeric, '8 oz can', null::int, null, 4),
  ('Unstuffed Pepper Pot', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 5),
  ('Unstuffed Pepper Pot', 'Chicken broth', 'Chicken broth', 3::numeric, 'cups', 1::numeric, '32 oz carton', null::int, null, 6),
  ('Unstuffed Pepper Pot', 'Shredded Mexican cheese', 'Shredded cheese', 6::numeric, 'oz', 0.5::numeric, '12 oz bag', null::int, null, 7),
  ('White Chicken Chili', 'Boneless skinless chicken breasts', 'Chicken breast or thighs', 48::numeric, 'oz', 3::numeric, 'lb', null::int, null, 0),
  ('White Chicken Chili', 'Great Northern beans', 'White beans', 3::numeric, 'cans', 3::numeric, '15.5 oz can', null::int, 'Cannellini or great northern', 1),
  ('White Chicken Chili', 'Sweet corn', 'Corn', 2::numeric, 'cups', 2::numeric, '15.25 oz can', null::int, null, 2),
  ('White Chicken Chili', 'Chopped green chiles', 'Diced green chiles', 8::numeric, 'oz', 2::numeric, '4 oz can', null::int, null, 3),
  ('White Chicken Chili', 'Chicken broth', 'Chicken broth', 5::numeric, 'cups', 1.25::numeric, '32 oz carton', null::int, null, 4),
  ('White Chicken Chili', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 5),
  ('White Chicken Chili', 'Greek yogurt tub', 'Greek yogurt', 1.5::numeric, 'cups', 0.375::numeric, '32 oz tub', null::int, 'Stir in off heat', 6),
  ('White Chicken Chili', 'Shredded Mexican cheese', 'Shredded cheese', 6::numeric, 'oz', 0.5::numeric, '12 oz bag', null::int, 'Monterey Jack or Mexican', 7),
  ('Turkey Lentil Stew', '85/15 ground turkey', 'Ground turkey', 32::numeric, 'oz', 0.67::numeric, '48 oz package', null::int, null, 0),
  ('Turkey Lentil Stew', 'Green lentils', 'Brown or green lentils', 2::numeric, 'cups dry', 1::numeric, '16 oz bag', null::int, null, 1),
  ('Turkey Lentil Stew', 'Russet potatoes', 'Potatoes', 24::numeric, 'oz', 0.3::numeric, '5 lb bag', null::int, 'Yellow or russet', 2),
  ('Turkey Lentil Stew', 'Baby carrots', 'Carrots', 4::numeric, 'whole', 0.5::numeric, 'package', null::int, null, 3),
  ('Turkey Lentil Stew', 'Diced tomatoes', 'Diced tomatoes', 2::numeric, 'cans', 2::numeric, '14.5 oz can', null::int, null, 4),
  ('Turkey Lentil Stew', 'Spinach', 'Spinach', 8::numeric, 'oz', 1::numeric, '8 oz bag', null::int, null, 5),
  ('Turkey Lentil Stew', 'Yellow onions', 'Yellow onion', 1::numeric, 'whole', 0.17::numeric, '3 lb bag', null::int, null, 6),
  ('Turkey Lentil Stew', 'Chicken broth', 'Chicken broth', 6::numeric, 'cups', 1.5::numeric, '32 oz carton', null::int, null, 7)
) as v(recipe_title, product_name, name, qty, unit, purchase_qty,
       purchase_unit, manual_cost_cents, notes, sort_order);


-- Methods: 56 steps across 13 recipes.

insert into recipe_steps (household_id, recipe_id, step_number, body)
select h.id, (select id from recipes where title = v.recipe_title limit 1),
       v.step_number, v.body
from (select id from household order by created_at limit 1) h,
(values
  ('Stuffed peppers', 1, 'Heat oven to 400F. Halve peppers lengthwise and remove seeds. Arrange cut-side up in a baking dish.'),
  ('Stuffed peppers', 2, 'Bake empty pepper halves for about 10 minutes while you make the filling. This keeps them tender without getting mushy.'),
  ('Stuffed peppers', 3, 'Brown 1.5 lb ground turkey in a large skillet. Add diced onion and cook until softened; add garlic for the final minute.'),
  ('Stuffed peppers', 4, 'Season with chili powder, cumin, salt, and pepper.'),
  ('Stuffed peppers', 5, 'Stir in drained pinto beans, cooked rice, diced tomatoes, and tomato sauce. Simmer 3-5 minutes until thick but still moist.'),
  ('Stuffed peppers', 6, 'Taste and adjust seasoning. Divide filling generously among the 6 pepper halves.'),
  ('Stuffed peppers', 7, 'Top with shredded cheese. Bake 15-20 minutes, until peppers are tender and cheese is melted.'),
  ('Stuffed peppers', 8, 'Rest 5 minutes before serving. Refrigerate leftovers for lunches.'),
  ('Salsa Verde Chicken & Rice', 1, 'Brown bite-size chicken pieces in a large pot with oil, salt, cumin, and garlic.'),
  ('Salsa Verde Chicken & Rice', 2, 'Stir in diced peppers, rice, drained beans, corn, salsa verde, and broth.'),
  ('Salsa Verde Chicken & Rice', 3, 'Bring to a boil, cover, and simmer on low until rice is tender, about 20 minutes.'),
  ('Salsa Verde Chicken & Rice', 4, 'Rest covered 10 minutes, fluff, and portion. Add cheese, avocado, cilantro, or Greek yogurt when serving.'),
  ('Turkey Taco Rice Pot', 1, 'Brown turkey in a large pot; add diced onion, peppers, and taco seasoning.'),
  ('Turkey Taco Rice Pot', 2, 'Stir in rice, drained beans, tomatoes, corn, and 3 1/2 cups water or broth.'),
  ('Turkey Taco Rice Pot', 3, 'Bring to a boil, cover, and simmer on low until rice is tender, about 20 minutes.'),
  ('Turkey Taco Rice Pot', 4, 'Rest 10 minutes and serve with salsa, cheese, avocado, or Greek yogurt.'),
  ('Mediterranean Chicken & Chickpea Pot', 1, 'Brown seasoned chicken pieces in a large pot with garlic, oregano, and black pepper.'),
  ('Mediterranean Chicken & Chickpea Pot', 2, 'Add rice, drained chickpeas, tomatoes, broth, and the zest and juice of one lemon.'),
  ('Mediterranean Chicken & Chickpea Pot', 3, 'Cover and simmer on low until rice and chicken are cooked, about 20 minutes.'),
  ('Mediterranean Chicken & Chickpea Pot', 4, 'Fold in spinach. Serve with cucumber, remaining lemon, and Greek-yogurt sauce.'),
  ('Korean-Inspired Turkey Rice Bowls', 1, 'Brown turkey in a large pot; add garlic and ginger for the final minute.'),
  ('Korean-Inspired Turkey Rice Bowls', 2, 'Stir in rice, 3 1/2 cups water, soy sauce, and a small amount of brown sugar or honey.'),
  ('Korean-Inspired Turkey Rice Bowls', 3, 'Cover and simmer on low until rice is nearly tender, about 17 minutes.'),
  ('Korean-Inspired Turkey Rice Bowls', 4, 'Fold in cabbage, carrots, and edamame; cover 5-7 minutes. Finish with rice vinegar or sesame oil if available.'),
  ('Cajun Chicken & Sausage Rice', 1, 'Brown sliced sausage and chicken pieces in a large pot; remove briefly if the pot is crowded.'),
  ('Cajun Chicken & Sausage Rice', 2, 'Saute diced peppers and onion, then stir in Cajun seasoning, rice, tomatoes, broth, chicken, and sausage.'),
  ('Cajun Chicken & Sausage Rice', 3, 'Bring to a boil, cover, and simmer on low until rice and chicken are cooked, about 20 minutes.'),
  ('Cajun Chicken & Sausage Rice', 4, 'Rest 10 minutes. Taste before adding salt because sausage and seasoning can be salty.'),
  ('Chicken Burrito Pot', 1, 'Brown seasoned chicken pieces in a large pot; add diced peppers and onion.'),
  ('Chicken Burrito Pot', 2, 'Stir in rice, drained beans, salsa, corn, and broth.'),
  ('Chicken Burrito Pot', 3, 'Cover and simmer on low until rice and chicken are cooked, about 20 minutes.'),
  ('Chicken Burrito Pot', 4, 'Rest 10 minutes. Serve as bowls or use leftovers in wraps, quesadillas, or nachos.'),
  ('Turkey Chili Mac', 1, 'Brown turkey in a large pot with diced onion, peppers, chili powder, and cumin.'),
  ('Turkey Chili Mac', 2, 'Add tomatoes, drained beans, 3 cups broth or water, and dry protein pasta.'),
  ('Turkey Chili Mac', 3, 'Simmer uncovered, stirring often, until pasta is tender and the sauce is thick, about 15 minutes.'),
  ('Turkey Chili Mac', 4, 'Rest 5 minutes and add cheese or Greek yogurt when serving. Add water during reheating if needed.'),
  ('Creamy Chicken, Broccoli & Rice', 1, 'Brown chicken pieces in a large pot; add diced onion and garlic.'),
  ('Creamy Chicken, Broccoli & Rice', 2, 'Stir in rice and broth. Cover and simmer on low for 15 minutes.'),
  ('Creamy Chicken, Broccoli & Rice', 3, 'Add broccoli over the rice, cover, and cook 7-10 minutes more until tender.'),
  ('Creamy Chicken, Broccoli & Rice', 4, 'Remove from heat. Rest 5 minutes, then stir in Greek yogurt and cheese. Do not boil after adding yogurt.'),
  ('One-Pot Chicken Chickpea Curry', 1, 'Brown chicken pieces in a large pot with curry powder, garlic, and ginger if available.'),
  ('One-Pot Chicken Chickpea Curry', 2, 'Stir in rice, drained chickpeas, tomatoes, coconut milk, broth, and vegetables.'),
  ('One-Pot Chicken Chickpea Curry', 3, 'Bring to a gentle boil, cover, and simmer on low until rice and chicken are cooked, about 22 minutes.'),
  ('One-Pot Chicken Chickpea Curry', 4, 'Rest 10 minutes. Finish with lime, cilantro, or Greek yogurt if desired.'),
  ('Unstuffed Pepper Pot', 1, 'Brown turkey in a large pot with diced onion, peppers, garlic, paprika, salt, and pepper.'),
  ('Unstuffed Pepper Pot', 2, 'Stir in rice, diced tomatoes, tomato sauce, and broth.'),
  ('Unstuffed Pepper Pot', 3, 'Cover and simmer on low until rice is tender, about 20 minutes.'),
  ('Unstuffed Pepper Pot', 4, 'Rest 10 minutes, fold in cheese, and portion. Freeze extra servings if desired.'),
  ('White Chicken Chili', 1, 'Brown or gently cook chicken pieces in a large pot with onion, garlic, cumin, and oregano.'),
  ('White Chicken Chili', 2, 'Add drained beans, corn, green chiles, and broth. Simmer until chicken is cooked, about 20 minutes.'),
  ('White Chicken Chili', 3, 'Mash some beans against the side of the pot to thicken, then simmer 10 minutes more.'),
  ('White Chicken Chili', 4, 'Remove from heat and stir in Greek yogurt. Add cheese, lime, cilantro, or avocado when serving.'),
  ('Turkey Lentil Stew', 1, 'Brown turkey in a large pot with diced onion, carrots, garlic, thyme, and black pepper.'),
  ('Turkey Lentil Stew', 2, 'Add rinsed lentils, diced potatoes, tomatoes, and broth.'),
  ('Turkey Lentil Stew', 3, 'Bring to a boil, then simmer partially covered until lentils and potatoes are tender, about 35 minutes.'),
  ('Turkey Lentil Stew', 4, 'Fold in spinach, adjust seasoning, and cool before refrigerating or freezing portions.')
) as v(recipe_title, step_number, body);


-- Weekly staples

insert into staples (household_id, item, weekly_qty, unit, preferred_store,
                     included, product_id, sort_order)
select h.id, v.item, v.weekly_qty, v.unit, 'ALDI', true,
       (select id from products where name = v.product_name limit 1), v.sort_order
from (select id from household order by created_at limit 1) h,
(values
  ('Golden Grade A Large White Eggs', 2::numeric, '12-ct cartons', 'Large eggs', 0),
  ('Friendly Farms Nonfat Plain Greek Yogurt', 1::numeric, '32-oz tub', 'Greek yogurt tub', 1),
  ('Friendly Farms Vanilla Protein Greek Yogurt Cups', 1::numeric, '4-pack', 'Greek yogurt cups', 2),
  ('Friendly Farms Lactose Free 2% Ultra Filtered Milk', 2::numeric, '59-fl-oz cartons', 'Ultra-filtered milk', 3)
) as v(item, weekly_qty, unit, product_name, sort_order);


commit;

-- ---------------------------------------------------------------------------
-- Verify. Run these separately after the seed.
-- ---------------------------------------------------------------------------
--
-- Ingredients that found no matching product. Expect cupboard spices, the
-- Udon marinade, and the smoothie supplements, and nothing else:
--
--   select r.title, i.name, i.preferred_product
--   from recipe_ingredients i join recipes r on r.id = i.recipe_id
--   where i.product_id is null and i.preferred_product is not null;
--
-- If preferred_product is set but product_id is null, that is a name
-- mismatch worth fixing rather than a genuine gap.
--
-- Row counts:
--   select 'products' t, count(*) from products
--   union all select 'recipes', count(*) from recipes
--   union all select 'ingredients', count(*) from recipe_ingredients
--   union all select 'steps', count(*) from recipe_steps
--   union all select 'staples', count(*) from staples;

