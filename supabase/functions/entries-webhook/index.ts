// Supabase Edge Function: entries-webhook
//
// Fired by the `entries_submit_webhook_*` triggers on public.entries whenever a
// partner's `submitted` flag flips false → true. It sends the two pushes the
// whole both-partner loop depends on:
//
//   "<Name> shared their heart tonight"  → the other partner hasn't written yet
//   "Tonight's reveal is ready"          → both are in; there is a payoff waiting
//
// The trigger is deliberately narrowed to the false → true transition (see the
// migration alongside this file). Before that it fired on *every* update where
// submitted was true — so adding a voice note, tapping a reaction, or answering
// the Grow check-back each re-sent "shared their heart tonight" to a partner who
// had already been told. That is the difference between a notification someone
// opens and one they turn off.
//
// Invoked by pg_net with no JWT (verify_jwt = false); it is only reachable from
// the trigger and reads nothing the caller supplies beyond the row itself.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface EntryRecord {
  couple_id: string;
  date: string;
  user_id: string;
  submitted: boolean;
}

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: "default",
      // A push that opens the thing it is about. `screen: "reveal"` is routed
      // straight to the reveal by app/_layout.tsx.
      data,
    }),
  });
}

/**
 * Rotating copy, indexed by date so the two partners never get contradictory
 * lines about the same night. Warm and specific — the partner's name is the
 * whole reason this one gets opened.
 */
function sharedMessage(senderName: string, date: string): { title: string; body: string } {
  const options = [
    {
      title: `${senderName} shared their heart tonight`,
      body: "Three small things, waiting for yours.",
    },
    {
      title: `${senderName} just finished tonight's three`,
      body: "Whenever you're ready — it only takes a minute.",
    },
    {
      title: `Something from ${senderName} is waiting`,
      body: "Share yours and you'll open them together.",
    },
  ];
  const dayIndex = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
  const count = options.length;
  return options[((dayIndex % count) + count) % count];
}

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const record = payload.record as EntryRecord | undefined;
    if (!record?.submitted) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sender } = await admin
      .from("couple_members")
      .select("name")
      .eq("couple_id", record.couple_id)
      .eq("user_id", record.user_id)
      .maybeSingle();

    const { data: partner } = await admin
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", record.couple_id)
      .neq("user_id", record.user_id)
      .maybeSingle();
    if (!partner) {
      // A couple of one. Nothing to send, and not an error.
      return new Response(JSON.stringify({ skipped: "no partner" }), { status: 200 });
    }

    const [{ data: partnerEntry }, { data: profile }] = await Promise.all([
      admin
        .from("entries")
        .select("submitted")
        .eq("couple_id", record.couple_id)
        .eq("date", record.date)
        .eq("user_id", partner.user_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("expo_push_token")
        .eq("id", partner.user_id)
        .maybeSingle(),
    ]);

    if (!profile?.expo_push_token) {
      return new Response(JSON.stringify({ sent: false, reason: "no push token" }), { status: 200 });
    }

    const senderName = sender?.name || "Your partner";

    if (partnerEntry?.submitted) {
      // Both are in. This is the highest-intent notification Lunara sends, so it
      // deep-links past the tab and straight into the reveal.
      await sendExpoPush(
        profile.expo_push_token,
        "Tonight's reveal is ready 🌙",
        `You and ${senderName} both wrote tonight. Open it together whenever you're ready.`,
        { screen: "reveal", notificationType: "reveal-ready", date: record.date },
      );
    } else {
      const { title, body } = sharedMessage(senderName, record.date);
      await sendExpoPush(profile.expo_push_token, title, body, {
        screen: "tonight",
        notificationType: "partner-submitted",
        date: record.date,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
