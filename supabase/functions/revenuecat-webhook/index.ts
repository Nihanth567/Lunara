// Supabase Edge Function: revenuecat-webhook
//
// RevenueCat → Supabase. Records a purchase against the paying user's *profile*,
// which is what actually unlocks Premium for the couple.
//
// Why profiles and not couples: `get_my_couple()` derives the couple's
// `is_subscribed` as `bool_or(profiles.is_subscribed)` across its members. So
// writing the paying partner's profile is what unlocks both of them, and it
// keeps working if they aren't paired yet — the moment they pair, the same
// `bool_or` picks the purchase up with no reconciliation step at all.
//
// This function previously wrote `couples.subscription_status`, a column that
// does not exist in this database (the migration adding it was never applied,
// and nothing reads it). Every purchase webhook therefore failed, and a user who
// wasn't paired yet got a 200 { handled: false } — telling RevenueCat the event
// was accepted so it would never retry. Both are fixed below.
//
// Configure in RevenueCat dashboard → Project settings → Integrations →
// Webhooks, with the Authorization header value set to REVENUECAT_WEBHOOK_SECRET.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

// Events that grant access.
//
// UNCANCELLATION and PRODUCT_CHANGE are here because both leave the user
// entitled. TRANSFER is here because the entitlement has moved *to* this
// app_user_id.
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'TRANSFER',
]);

// Events that revoke it.
//
// CANCELLATION is deliberately NOT here: in RevenueCat it means auto-renew was
// switched off, and the subscription stays active until it expires. Treating it
// as a revocation took Premium away from people who had paid through the end of
// their term. EXPIRATION is the event that actually ends access.
const EXPIRED_EVENTS = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request): boolean {
  if (!REVENUECAT_WEBHOOK_SECRET) return false;
  const header = req.headers.get('Authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  return provided === REVENUECAT_WEBHOOK_SECRET;
}

/**
 * The Supabase auth user id behind an event.
 *
 * `configurePurchases()` sets appUserID to the Supabase user id, but RevenueCat
 * also carries anonymous ids (`$RCAnonymousID:…`) and aliases from before a
 * login. Take the first value that looks like one of our user ids.
 */
function resolveUserId(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return candidates.find((id): id is string => typeof id === 'string' && UUID_RE.test(id)) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = (await req.json()) as { event?: RevenueCatEvent };
    const event = body?.event;
    const eventType = event?.type;

    if (!eventType || !event?.app_user_id) {
      return jsonResponse({ error: 'Malformed webhook payload' }, 400);
    }

    let nextStatus: boolean | null = null;
    if (ACTIVE_EVENTS.has(eventType)) nextStatus = true;
    else if (EXPIRED_EVENTS.has(eventType)) nextStatus = false;

    if (nextStatus === null) {
      // BILLING_ISSUE, TEST, SUBSCRIBER_ALIAS, … — nothing to change, and no
      // amount of retrying would change that. Acknowledge and move on.
      return jsonResponse({ handled: false, reason: `Ignored event type: ${eventType}` });
    }

    const userId = resolveUserId(event);
    if (!userId) {
      // A purchase made before the user ever signed in. There is no profile to
      // attribute it to and retrying will not produce one; RevenueCat will send
      // a SUBSCRIBER_ALIAS/TRANSFER once the anonymous id is linked to a real
      // one, and that event carries the id we need.
      return jsonResponse({
        handled: false,
        reason: 'No Supabase user id on this event (anonymous RevenueCat customer)',
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // `.select()` so a write that matched no row is distinguishable from one
    // that landed. A silent zero-row update is how a paid subscription ends up
    // invisible to the app.
    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({
        is_subscribed: nextStatus,
        revenuecat_app_user_id: event.app_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id');

    if (updateError) {
      // 500 so RevenueCat retries — a dropped purchase event is a customer who
      // paid and never got what they paid for.
      return jsonResponse({ error: 'Could not update subscription status', detail: updateError.message }, 500);
    }

    if (!updated?.length) {
      // The profile row is created by the on_auth_user_created trigger, so this
      // is a race (or a deleted account) rather than a permanent condition.
      // 404 keeps the event on RevenueCat's retry queue instead of dropping it.
      return jsonResponse({ handled: false, reason: 'No profile for this user id', user_id: userId }, 404);
    }

    return jsonResponse({ handled: true, user_id: userId, is_subscribed: nextStatus });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
