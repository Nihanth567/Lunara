// Supabase Edge Function: send-nudge
//
// Called from the app when a partner who has already submitted tonight's
// entry wants to gently let the other partner know they're waiting.
//
// POST body: { target_user_id: string, couple_id: string }
//
// The caller is authenticated via their Supabase JWT (forwarded in the
// Authorization header by supabase-js automatically). We verify the caller
// and the target both belong to the given couple before sending anything —
// this is a private nudge between two paired partners, never a broadcast.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NudgePayload {
  target_user_id?: string;
  couple_id?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    // Client scoped to the caller's JWT, purely to establish who is calling.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    const { target_user_id, couple_id } = (await req.json()) as NudgePayload;
    if (!target_user_id || !couple_id) {
      return jsonResponse({ error: 'target_user_id and couple_id are required' }, 400);
    }
    if (target_user_id === caller.id) {
      return jsonResponse({ error: 'Cannot nudge yourself' }, 400);
    }

    // Service-role client for the membership check and the profile lookup —
    // both partners' rows here, not just the caller's own, so RLS as the
    // caller wouldn't reliably see the target's push token.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: members, error: membersError } = await admin
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', couple_id)
      .in('user_id', [caller.id, target_user_id]);
    if (membersError) {
      return jsonResponse({ error: 'Could not verify couple membership' }, 500);
    }
    const memberIds = new Set((members ?? []).map((m) => m.user_id));
    if (!memberIds.has(caller.id) || !memberIds.has(target_user_id)) {
      return jsonResponse({ error: 'Both users must belong to this couple' }, 403);
    }

    const { data: targetProfile, error: profileError } = await admin
      .from('profiles')
      .select('expo_push_token')
      .eq('id', target_user_id)
      .maybeSingle();
    if (profileError) {
      return jsonResponse({ error: 'Could not look up partner profile' }, 500);
    }

    const pushToken = targetProfile?.expo_push_token;
    if (!pushToken) {
      // Nothing was sent, so this must not read as success. It used to return
      // 200 { sent: false }, which supabase-js reports as no error at all — the
      // app then told the sender their partner "will get a soft ping" when no
      // push had left the building. Unprocessable, not OK.
      return jsonResponse(
        { sent: false, reason: 'no_push_token', message: 'Partner has no registered push token' },
        422,
      );
    }

    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title: 'Lunara',
        body: 'Your partner completed their answers for tonight. Ready to share yours?',
        data: { type: 'nudge', couple_id },
      }),
    });

    if (!expoResponse.ok) {
      const detail = await expoResponse.text().catch(() => '');
      return jsonResponse(
        { sent: false, reason: 'push_service_error', message: 'Expo push request failed', detail },
        502,
      );
    }

    const expoResult = await expoResponse.json();
    const ticket = expoResult?.data;
    if (!ticket || ticket.status === 'error') {
      // `DeviceNotRegistered` means the stored token is dead — clear it so the
      // next lookup is honest instead of failing the same way every night.
      const errorCode = ticket?.details?.error;
      if (errorCode === 'DeviceNotRegistered') {
        await admin
          .from('profiles')
          .update({ expo_push_token: null })
          .eq('id', target_user_id)
          .eq('expo_push_token', pushToken);
      }
      return jsonResponse(
        {
          sent: false,
          reason: errorCode === 'DeviceNotRegistered' ? 'device_unregistered' : 'push_rejected',
          message: ticket?.message ?? 'Push ticket error',
        },
        502,
      );
    }

    return jsonResponse({ sent: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
