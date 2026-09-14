-- Second batch of recipe photography (docs/backlog-recipe-images.md),
-- following 020's pattern: AI-generated per the backlog's "Route 3"
-- recommendation, marked ai_generated so a later "which of these are real"
-- query is one where clause, and a photographed dish can replace one of
-- these one-for-one without a migration. Provenance is user_supplied (Nick
-- generated and chose these exact files, same generation batch as Cajun),
-- which locks each against a future bulk image-enrichment pass overwriting
-- it via trellis_may_enrich().
--
-- 17 of the household's 18 other recipes -- Chicken Tortilla Soup had no
-- file in this generation batch and stays on the tinted-plate fallback.
-- Bytes were uploaded to the recipe-images bucket (018) at <recipe_id>.jpg
-- ahead of this migration, the same drift-recovery pattern the bucket
-- itself was captured in.

update recipes r
set image_url = 'https://useanivealpkicohodeo.supabase.co/storage/v1/object/public/recipe-images/' || r.id || '.jpg',
    image_source = 'ai_generated'
where r.id in (
  'bd1ae943-bc09-4ad6-8e1f-53b484809ae8', -- Filthy cabbage
  '0a4707ce-31cf-45dd-9e62-561e681b16d3', -- Stuffed peppers
  'fb3323a0-9e76-4795-8281-c818217c7d8e', -- Steak salad
  '8213e7b9-337e-4a99-8fa1-6ea75e87816d', -- Turkey Rosso Pesto Protein Pasta
  'bf6a21b1-8211-45f7-ae77-78b1549f133f', -- Protein Berry Smoothie
  '65bb9861-4b39-4c12-bb15-60b763f5065f', -- Asian Beef Udon Stir-Fry
  '75007909-e9dc-433d-8dc2-ad4bbeaef14b', -- Salsa Verde Chicken & Rice
  'f4555843-a62d-445f-8b40-5b735951a776', -- Turkey Taco Rice Pot
  '4753440d-2bc2-4dbb-aecc-1235bfb79db7', -- Mediterranean Chicken & Chickpea Pot
  '19e83e81-20e1-4598-a0a4-12287cfc4fa1', -- Korean-Inspired Turkey Rice Bowls
  'f17c90bc-daeb-4aaa-83f2-aa1a1940bc44', -- Chicken Burrito Pot
  'ab01811d-0756-4601-88e5-6b77a581bd9c', -- Turkey Chili Mac
  'f6eaaade-c4e3-40ed-9943-a40536879444', -- Creamy Chicken, Broccoli & Rice
  '802c35db-2e47-4307-8711-e1c631e0a289', -- One-Pot Chicken Chickpea Curry
  'd5c20a51-020f-470a-af85-724be3010099', -- Unstuffed Pepper Pot
  '672e002b-a3c2-4bb1-b0ec-c5943e817785', -- White Chicken Chili
  'bffe970d-a3a3-4c86-bfd8-da4a88622085'  -- Turkey Lentil Stew
);

insert into recipe_field_provenance (recipe_id, household_id, field_name, source_type, confidence)
select id, household_id, 'image_url', 'user_supplied', 1.0
from recipes
where id in (
  'bd1ae943-bc09-4ad6-8e1f-53b484809ae8',
  '0a4707ce-31cf-45dd-9e62-561e681b16d3',
  'fb3323a0-9e76-4795-8281-c818217c7d8e',
  '8213e7b9-337e-4a99-8fa1-6ea75e87816d',
  'bf6a21b1-8211-45f7-ae77-78b1549f133f',
  '65bb9861-4b39-4c12-bb15-60b763f5065f',
  '75007909-e9dc-433d-8dc2-ad4bbeaef14b',
  'f4555843-a62d-445f-8b40-5b735951a776',
  '4753440d-2bc2-4dbb-aecc-1235bfb79db7',
  '19e83e81-20e1-4598-a0a4-12287cfc4fa1',
  'f17c90bc-daeb-4aaa-83f2-aa1a1940bc44',
  'ab01811d-0756-4601-88e5-6b77a581bd9c',
  'f6eaaade-c4e3-40ed-9943-a40536879444',
  '802c35db-2e47-4307-8711-e1c631e0a289',
  'd5c20a51-020f-470a-af85-724be3010099',
  '672e002b-a3c2-4bb1-b0ec-c5943e817785',
  'bffe970d-a3a3-4c86-bfd8-da4a88622085'
)
on conflict (recipe_id, field_name)
do update set source_type = excluded.source_type, confidence = excluded.confidence, updated_at = now();
