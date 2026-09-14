-- 018 granted SELECT on storage.objects (recipe-images) to both anon and
-- authenticated. That's broader than needed: a public bucket already serves
-- GET /storage/v1/object/public/... with no RLS check at all, which is what
-- every <img> tag in this app actually uses and what has to stay
-- credential-free (the wall runs unattended for weeks; an expiring signed
-- URL is a broken image by design). The SELECT policy only governs
-- list()/metadata operations, which nothing in this app calls — so granting
-- it to anon did nothing but let anyone holding the (already-public) anon
-- key enumerate the bucket's filenames. Restrict listing to authenticated;
-- direct image display is unaffected.

drop policy "recipe_images_public_read" on storage.objects;

create policy "recipe_images_authenticated_list"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'recipe-images');
