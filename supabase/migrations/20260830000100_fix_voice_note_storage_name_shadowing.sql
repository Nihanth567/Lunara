-- Voice notes could never be uploaded or played back. Not by a free user, not
-- by a Pro one — the feature was impossible server-side from the moment it
-- shipped, and nothing in the app surfaced why.
--
-- The cause is a column-name collision inside the storage policies.
-- `20260828000100_voice_notes_storage.sql` wrote the couple-membership check as:
--
--   exists (
--     select 1 from public.couple_members cm
--     where cm.user_id = auth.uid()
--       and cm.couple_id::text = (storage.foldername(name))[1]   -- <-- here
--   )
--
-- Inside that subquery `name` is ambiguous: `storage.objects` has a `name`
-- column (the object path, which is what was meant) and `public.couple_members`
-- also has a `name` column (the member's display name). Postgres resolves an
-- unqualified reference to the innermost FROM, so it bound to
-- `couple_members.name` — the partner's *display name*. pg_policies confirms it,
-- rendering the stored expression back as `storage.foldername(cm.name)`.
--
-- `storage.foldername('Kai')` is `{}`, an empty array, so subscript [1] is NULL,
-- so `cm.couple_id::text = NULL` is NULL, so the EXISTS is never true. Both the
-- SELECT and the INSERT policy hang off that EXISTS, which means:
--
--   * every upload was denied — including the uploader's own recording
--   * every read was denied — including your own, so nothing ever played back
--
-- Silent, total, and invisible in the client, which reports a storage failure as
-- a generic upload error. It also failed *closed*, so no data was ever exposed.
--
-- The fix is to qualify the reference as `storage.objects.name` everywhere a
-- table with its own `name` column is in scope. The policy logic is otherwise
-- unchanged and still mirrors the reveal gate on public.entries: your own
-- recording always; your partner's only once both of you have submitted that
-- date.
--
-- The UPDATE and DELETE policies are re-created verbatim. They were never wrong
-- (no shadowing table is in scope in either), but they are restated here so the
-- whole bucket's policy set reads from one place.

drop policy if exists "voice notes are readable once both partners submitted" on storage.objects;
drop policy if exists "partners can upload their own voice notes"            on storage.objects;
drop policy if exists "partners can replace their own voice notes"           on storage.objects;
drop policy if exists "partners can delete their own voice notes"            on storage.objects;

-- Read: always your own recording; a partner's only once BOTH of you have
-- submitted that date — the same condition as the
-- "select partner entries after mutual submit" policy on public.entries.
--
-- Path layout the segments below index into:
--   {couple_id}/{date}/{user_id}/{slot}.m4a
--   segment 1 ^        2 ^       3 ^
--
-- Segments are compared as text against `<column>::text` rather than cast to
-- uuid/date. An object path is untrusted input, and casting it would raise on a
-- malformed path instead of simply failing to match.
create policy "voice notes are readable once both partners submitted"
on storage.objects for select to authenticated
using (
  bucket_id = 'voice-notes'
  and exists (
    select 1 from public.couple_members cm
    where cm.user_id = auth.uid()
      and cm.couple_id::text = (storage.foldername(storage.objects.name))[1]
  )
  and (
    -- my own recording, always
    (storage.foldername(storage.objects.name))[3] = auth.uid()::text
    or (
      -- my entry for that date is submitted…
      exists (
        select 1 from public.entries mine
        where mine.couple_id::text = (storage.foldername(storage.objects.name))[1]
          and mine.date::text      = (storage.foldername(storage.objects.name))[2]
          and mine.user_id         = auth.uid()
          and mine.submitted
      )
      -- …and so is theirs. (This subquery is itself filtered by the entries
      -- RLS, so it can only see the partner row once the gate has opened.)
      and exists (
        select 1 from public.entries theirs
        where theirs.couple_id::text = (storage.foldername(storage.objects.name))[1]
          and theirs.date::text      = (storage.foldername(storage.objects.name))[2]
          and theirs.user_id::text   = (storage.foldername(storage.objects.name))[3]
          and theirs.submitted
      )
    )
  )
);

-- Write: only into your own folder, only inside a couple you belong to.
create policy "partners can upload their own voice notes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voice-notes'
  and (storage.foldername(storage.objects.name))[3] = auth.uid()::text
  and exists (
    select 1 from public.couple_members cm
    where cm.user_id = auth.uid()
      and cm.couple_id::text = (storage.foldername(storage.objects.name))[1]
  )
);

create policy "partners can replace their own voice notes"
on storage.objects for update to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(storage.objects.name))[3] = auth.uid()::text
)
with check (
  bucket_id = 'voice-notes'
  and (storage.foldername(storage.objects.name))[3] = auth.uid()::text
);

create policy "partners can delete their own voice notes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(storage.objects.name))[3] = auth.uid()::text
);
