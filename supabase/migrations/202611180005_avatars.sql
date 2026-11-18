begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('survive9ja-avatars', 'survive9ja-avatars', true, 1048576, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists survive9ja_insert_own_avatar on storage.objects;
create policy survive9ja_insert_own_avatar
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'survive9ja-avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  );

commit;
