-- Private `voice-notes` bucket for the optional voice recording on each
-- ritual card, plus RLS that mirrors the reveal gate on public.entries.
--
-- Object path layout (the policies below depend on it):
--   {couple_id}/{date}/{user_id}/{slot}.m4a
--   segment 1 ^        2 ^       3 ^
--
-- Unlike `avatars`, this bucket is NOT public — nothing here is readable by
-- URL. The app fetches a short-lived signed URL for playback, so a leaked
-- object path on its own grants no access.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes',
  'voice-notes',
  false,
  10485760, -- 10 MB; a 2-minute m4a is well under 1 MB
  array['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/x-m4a']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "voice notes are readable once both partners submitted" on storage.objects;
drop policy if exists "partners can upload their own voice notes"            on storage.objects;
drop policy if exists "partners can replace their own voice notes"           on storage.objects;
drop policy if exists "partners can delete their own voice notes"            on storage.objects;

-- Read: always your own recording; a partner's only once BOTH of you have
-- submitted that date — the same condition as the
-- "select partner entries after mutual submit" policy on public.entries.
--
-- Note the couple/date/user segments are compared as text against
-- `<column>::text` rather than cast to uuid/date. An object path is untrusted
-- input, and casting it would raise on a malformed path instead of simply
-- failing to match.
create policy "voice notes are readable once both partners submitted"
on storage.objects for select to authenticated
using (
  bucket_id = 'voice-notes'
  and exists (
    select 1 from public.couple_members cm
    where cm.user_id = auth.uid()
      and cm.couple_id::text = (storage.foldername(name))[1]
  )
  and (
    -- my own recording, always
    (storage.foldername(name))[3] = auth.uid()::text
    or (
      -- my entry for that date is submitted…
      exists (
        select 1 from public.entries mine
        where mine.couple_id::text = (storage.foldername(name))[1]
          and mine.date::text     = (storage.foldername(name))[2]
          and mine.user_id        = auth.uid()
          and mine.submitted
      )
      -- …and so is theirs. (This subquery is itself filtered by the entries
      -- RLS, so it can only see the partner row once the gate has opened.)
      and exists (
        select 1 from public.entries theirs
        where theirs.couple_id::text = (storage.foldername(name))[1]
          and theirs.date::text     = (storage.foldername(name))[2]
          and theirs.user_id::text  = (storage.foldername(name))[3]
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
  and (storage.foldername(name))[3] = auth.uid()::text
  and exists (
    select 1 from public.couple_members cm
    where cm.user_id = auth.uid()
      and cm.couple_id::text = (storage.foldername(name))[1]
  )
);

create policy "partners can replace their own voice notes"
on storage.objects for update to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[3] = auth.uid()::text
)
with check (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[3] = auth.uid()::text
);

create policy "partners can delete their own voice notes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[3] = auth.uid()::text
);
