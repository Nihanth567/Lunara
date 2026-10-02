-- Invite codes were sometimes five characters, or fewer.
--
-- The alphabet below has 32 characters, but the index was
-- `floor(random() * 33) + 1` — 1 to 33. Position 33 does not exist, `substr`
-- returns '' for it, and the code came out a character short. Across six
-- characters that is about one couple in six (1 - (32/33)^6 ≈ 17%).
--
-- The app accepts exactly six (`isWellFormedInviteCode` in lib/inviteLinks.ts),
-- so for those couples the Join button never enabled and the partner could not
-- join at all. Found by the end-to-end test, which drew the code "7QQQK".
--
-- Only the index changes. Grants are untouched by CREATE OR REPLACE.

create or replace function public.create_couple(p_user_name text)
returns couples
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
  v_couple public.couples;
  v_exists int;
begin
  select count(*) into v_exists from public.couple_members where user_id = auth.uid();
  if v_exists > 0 then
    raise exception 'This device is already paired.' using errcode = 'P0001';
  end if;

  loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;

  insert into public.couples (invite_code, start_date, member_count)
  values (v_code, current_date, 1)
  returning * into v_couple;

  insert into public.couple_members (couple_id, user_id, name)
  values (v_couple.id, auth.uid(), p_user_name);

  return v_couple;
end;
$function$;
