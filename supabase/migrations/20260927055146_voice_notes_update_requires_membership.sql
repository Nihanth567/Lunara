-- Voice-note UPDATE now requires couple membership, like INSERT always has.
--
-- The UPDATE policy on the `voice-notes` bucket only checked that segment 3 of
-- the path was your own user id. An upsert (which is how a re-record replaces
-- the previous take) or a Storage `move` is an UPDATE on storage.objects, and
-- its WITH CHECK is what governs the row's *new* name — so as written, you
-- could move one of your own recordings into another couple's folder:
--
--   {their_couple_id}/{date}/{your_user_id}/grateful.m4a
--
-- Nobody could read it there (the SELECT policy requires membership of the
-- couple in segment 1), so this was never an exposure. But "only members of a
-- couple can write into that couple's audio" should be true of every write
-- path, not just INSERT.
--
-- Path layout the segments below index into:
--   {couple_id}/{date}/{user_id}/{slot}.m4a
--   segment 1 ^        2 ^       3 ^
--
-- `storage.objects.name` is qualified on purpose: `couple_members` has its own
-- `name` column, and an unqualified reference binds to it instead. See
-- 20260831193933_fix_voice_note_storage_name_shadowing.sql.
--
-- DELETE is left as it is: you can always remove your own recording, even
-- from a couple you have since left.

drop policy if exists "partners can replace their own voice notes" on storage.objects;

create policy "partners can replace their own voice notes"
on storage.objects for update to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(storage.objects.name))[3] = auth.uid()::text
  and exists (
    select 1 from public.couple_members cm
    where cm.user_id = auth.uid()
      and cm.couple_id::text = (storage.foldername(storage.objects.name))[1]
  )
)
with check (
  bucket_id = 'voice-notes'
  and (storage.foldername(storage.objects.name))[3] = auth.uid()::text
  and exists (
    select 1 from public.couple_members cm
    where cm.user_id = auth.uid()
      and cm.couple_id::text = (storage.foldername(storage.objects.name))[1]
  )
);
