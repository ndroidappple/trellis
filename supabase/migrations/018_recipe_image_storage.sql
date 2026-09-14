-- Recipe photography (docs/backlog-recipe-images.md): a Storage bucket for
-- recipe.image_url. The bucket already existed live (created ad hoc against
-- the project on 2026-09-14, ahead of this migration) but carried no RLS
-- policies, so this captures both in git — the same drift-recovery pattern
-- 004-006 needed.
--
-- Public read, not signed URLs: the wall renders these for weeks unattended,
-- and an expiring signed URL is a broken image by design (see the backlog
-- doc's storage section). Writes are gated to authenticated users — this
-- project's whole trust model is the two-person signup allowlist in
-- handle_new_user(), so "authenticated" already means "a household member,"
-- same as every other table's RLS here.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "recipe_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'recipe-images');

create policy "recipe_images_authenticated_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-images');

create policy "recipe_images_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-images')
  with check (bucket_id = 'recipe-images');

create policy "recipe_images_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recipe-images');
