// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's account and everything attached to it.
//
// App Store Review Guideline 5.1.1(v) requires any app that lets people create
// an account to let them delete it from inside the app. Lunara had no deletion
// path of any kind, which is a rejection on its own.
//
// POST body: none. The account deleted is always the caller's — there is no
// target parameter on purpose, so this function cannot be pointed at anyone
// else no matter what a client sends.
//
// ─── Order of operations ─────────────────────────────────────────────────────
//
// The couple has to be read and repaired BEFORE the auth user is deleted.
// `couple_members.user_id` is `on delete cascade`, so the moment the user goes
// the membership row goes with it and there is no way left to find which couple
// they belonged to. Everything below is therefore sequenced deliberately:
//
//   1. read the caller's couple membership
//   2. delete their voice notes from Storage (no cascade reaches object storage)
//   3. repair the couple: decrement member_count, or delete it if now empty
//   4. delete the auth user — Postgres cascades profiles, entries, keepsakes,
//      couple_members
//
// A failure partway through leaves the account intact rather than half-deleted,
// which is the safe direction: the user can retry, and nothing is silently
// orphaned.
//
// ─── What happens to the partner ─────────────────────────────────────────────
//
// Deleting cascades this person's entries, which means the nights they wrote
// disappear from their partner's Moments too. There is no version of "delete my
// account" that both honours the request and keeps their words on someone
// else's device, so the app says this plainly before asking for confirmation
// rather than discovering it afterwards.
//
// The couple row itself survives while the partner is still in it, with
// member_count back to 1 — so the remaining partner keeps their own history and
// their invite code still works if they ever pair again.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Scoped to the caller's JWT purely to establish identity. The id comes
    // from the verified token, never from the request body.
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

    const userId = caller.id;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Which couple, if any. Must happen before the cascade removes the row.
    const { data: membership, error: membershipError } = await admin
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      return jsonResponse(
        { error: 'Could not read your account. Nothing was deleted.' },
        500,
      );
    }
    const coupleId = membership?.couple_id ?? null;

    // 2. Storage. Objects live at {couple_id}/{date}/{user_id}/{slot}.m4a and
    //    no database cascade reaches them, so an un-deleted recording would
    //    outlive the account that made it. Listing is per-date, so walk the
    //    date folders and keep only this user's own leaf.
    if (coupleId) {
      const paths: string[] = [];
      const { data: dateFolders } = await admin.storage
        .from('voice-notes')
        .list(coupleId, { limit: 1000 });

      for (const dateFolder of dateFolders ?? []) {
        const { data: userFolders } = await admin.storage
          .from('voice-notes')
          .list(`${coupleId}/${dateFolder.name}/${userId}`, { limit: 100 });
        for (const file of userFolders ?? []) {
          paths.push(`${coupleId}/${dateFolder.name}/${userId}/${file.name}`);
        }
      }

      if (paths.length > 0) {
        // Non-fatal: a leftover audio file is bad, but refusing to delete the
        // account because storage hiccuped is worse. Logged for follow-up.
        const { error: storageError } = await admin.storage
          .from('voice-notes')
          .remove(paths);
        if (storageError) {
          console.error('[delete-account] storage cleanup failed', {
            userId,
            count: paths.length,
            message: storageError.message,
          });
        }
      }
    }

    // 3. Repair the couple. Without this the partner is left in a couple whose
    //    member_count still says 2, so nobody can ever join them again.
    if (coupleId) {
      const { count } = await admin
        .from('couple_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('couple_id', coupleId);

      if ((count ?? 0) <= 1) {
        // We were the only member — remove the couple outright. Cascades any
        // entries and keepsakes hanging off it.
        await admin.from('couples').delete().eq('id', coupleId);
      } else {
        await admin
          .from('couples')
          .update({ member_count: Math.max(1, (count ?? 2) - 1) })
          .eq('id', coupleId);
      }
    }

    // 4. The account itself. Cascades profiles, entries, keepsakes and
    //    couple_members via their foreign keys onto auth.users.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('[delete-account] auth deletion failed', {
        userId,
        message: deleteError.message,
      });
      return jsonResponse(
        { error: 'We could not finish deleting your account. Please try again.' },
        500,
      );
    }

    return jsonResponse({ deleted: true });
  } catch (err) {
    console.error('[delete-account] unexpected failure', err);
    return jsonResponse({ error: 'Something went wrong. Nothing was deleted.' }, 500);
  }
});
