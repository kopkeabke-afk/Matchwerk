-- Matchwerk – users may list/read their own photo folder through the Storage API.
-- Needed so "Konto löschen" can find and remove all of a user's photos (GDPR).
-- Public display of photos is unaffected: the bucket is public and served via public URLs.
drop policy if exists "read own photos" on storage.objects;
create policy "read own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
