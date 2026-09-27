-- Voice notes + the Grow check-back reply, both hung off the existing
-- `entries` row rather than new tables.
--
-- Why on `entries`: the reveal gate ("a partner's answers are not returned
-- until both have submitted for that date") is already enforced by the
-- entries RLS policies. Storing the voice-note paths and the follow-up reply
-- as columns on the same row means they inherit that gate for free — there is
-- no second policy that can drift out of sync with the first.
--
-- The voice_* columns hold a Storage object path inside the private
-- `voice-notes` bucket, never a URL:
--   {couple_id}/{date}/{user_id}/{slot}.m4a
-- Playback always goes through a short-lived signed URL.

alter table public.entries
  add column if not exists voice_grateful text,
  add column if not exists voice_cute     text,
  add column if not exists voice_grow     text;

-- The next-day "did you try a small step from yesterday's Grow note?" reply.
-- One value per partner per day; null means not asked / not answered.
alter table public.entries
  add column if not exists grow_followup text
    check (grow_followup in ('yes', 'a_little', 'not_yet')),
  add column if not exists grow_followup_at timestamptz;

comment on column public.entries.voice_grateful is
  'Storage path in the private voice-notes bucket for this partner''s Grateful voice note.';
comment on column public.entries.voice_cute is
  'Storage path in the private voice-notes bucket for this partner''s Cute voice note.';
comment on column public.entries.voice_grow is
  'Storage path in the private voice-notes bucket for this partner''s Grow voice note.';
comment on column public.entries.grow_followup is
  'Reply to the next-day Grow check-back: yes | a_little | not_yet.';
