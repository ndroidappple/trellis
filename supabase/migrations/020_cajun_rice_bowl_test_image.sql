-- First real recipe photo, wired up as a test of the recipe-photography
-- pipeline (docs/backlog-recipe-images.md). AI-generated per the backlog's
-- interim "Route 3" recommendation — marked ai_generated so a later "which
-- of these are real" query is one where clause, and a photographed dish can
-- replace it one-for-one without a migration. Provenance is user_supplied
-- (Nick chose and supplied this exact file), which locks it against a future
-- bulk image-enrichment pass overwriting it via trellis_may_enrich().

update recipes
set image_url = 'https://useanivealpkicohodeo.supabase.co/storage/v1/object/public/recipe-images/f48ed829-7879-4da8-8a08-ba6f4e9a6ff5.jpg',
    image_source = 'ai_generated'
where id = 'f48ed829-7879-4da8-8a08-ba6f4e9a6ff5';

insert into recipe_field_provenance (recipe_id, household_id, field_name, source_type, confidence)
select id, household_id, 'image_url', 'user_supplied', 1.0
from recipes
where id = 'f48ed829-7879-4da8-8a08-ba6f4e9a6ff5'
on conflict (recipe_id, field_name)
do update set source_type = excluded.source_type, confidence = excluded.confidence, updated_at = now();
