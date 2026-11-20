-- Ejecutar una sola vez en el SQL Editor del proyecto Pura Gracia Radio - Artículos.
-- Crea el bucket público para imágenes de artículos y limita quién puede subir/modificar archivos.

alter table public.articles
  add column if not exists cover_image_url text,
  add column if not exists cover_image_alt text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'articles-images',
  'articles-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view article images" on storage.objects;
create policy "Public can view article images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'articles-images');

drop policy if exists "Editors and admins can upload article images" on storage.objects;
create policy "Editors and admins can upload article images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'articles-images'
  and (
    (select public.current_app_role()) = 'admin'
    or (
      (select public.current_app_role()) = 'editor'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
);

drop policy if exists "Owners and admins can update article images" on storage.objects;
create policy "Owners and admins can update article images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'articles-images'
  and (
    (select public.current_app_role()) = 'admin'
    or (
      (select public.current_app_role()) = 'editor'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
)
with check (
  bucket_id = 'articles-images'
  and (
    (select public.current_app_role()) = 'admin'
    or (
      (select public.current_app_role()) = 'editor'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
);

drop policy if exists "Owners and admins can delete article images" on storage.objects;
create policy "Owners and admins can delete article images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'articles-images'
  and (
    (select public.current_app_role()) = 'admin'
    or (
      (select public.current_app_role()) = 'editor'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
);
