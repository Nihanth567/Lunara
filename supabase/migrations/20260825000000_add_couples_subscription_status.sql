-- Subscription status, and the reason it is a *profile* column rather than a
-- couple one despite this migration's name (which is kept as-is because the
-- live database already records this version under it).
--
-- RevenueCat attributes a purchase to an `app_user_id`, which Lunara sets to
-- the Supabase user id (`configurePurchases` in lib/purchases.ts). A webhook
-- therefore learns about a *person*, never about a couple. Storing the flag on
-- the person who paid and aggregating it up is what makes "one subscription
-- covers both of you" true without the webhook having to know anything about
-- pairing — and it survives the couple being formed, dissolved, or re-formed
-- after the purchase.
--
-- `get_my_couple` is replaced below to fold that aggregate in as
-- `is_subscribed`, so the client keeps reading one field off one row and
-- `isPro(couple)` (lib/entitlements.ts) stays the single gate.

alter table public.profiles
  add column if not exists is_subscribed boolean not null default false,
  add column if not exists revenuecat_app_user_id text;

comment on column public.profiles.is_subscribed is
  'Written by the revenuecat-webhook edge function. The server''s mirror of the entitlement — authoritative for the partner who did not pay, and lagging by however long the webhook takes for the one who did. The paying device reads RevenueCat directly (lib/purchases.ts checkIsPro) so a purchase or a restore unlocks immediately rather than waiting on this.';

comment on column public.profiles.revenuecat_app_user_id is
  'The RevenueCat app_user_id seen on the webhook payload. Equal to profiles.id in normal operation; stored so a mismatch is diagnosable rather than invisible.';

-- Either partner's subscription unlocks Pro for the couple. bool_or over the
-- members is the whole of that rule.
--
-- Dropped first, not replaced: adding `is_subscribed` changes the function's
-- return type, and `create or replace` refuses that with "cannot change return
-- type of existing function". Only the no-argument signature exists, so the
-- drop is unambiguous.
drop function if exists public.get_my_couple();

create function public.get_my_couple()
returns table (
  id             uuid,
  invite_code    text,
  partner_name   text,
  start_date     date,
  current_streak int,
  longest_streak int,
  is_subscribed  boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    c.id,
    c.invite_code,
    coalesce((select cm2.name from public.couple_members cm2 where cm2.couple_id = c.id and cm2.user_id != auth.uid() limit 1), 'Waiting...') as partner_name,
    c.start_date,
    c.current_streak,
    c.longest_streak,
    coalesce((
      select bool_or(p.is_subscribed)
      from public.couple_members cm3
      join public.profiles p on p.id = cm3.user_id
      where cm3.couple_id = c.id
    ), false) as is_subscribed
  from public.couples c
  join public.couple_members cm on cm.couple_id = c.id
  where cm.user_id = auth.uid();
$function$;
