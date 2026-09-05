// Supabase Edge Function: grow-guidance
//
// Called from components/GrowGuidance.tsx (via lib/growGuidance.ts) after both
// partners reveal tonight's Grow answers. Turns their two short notes into 2-3
// gentle, concrete, non-prescriptive suggestions using OpenAI.
//
// Requires the OPENAI_API_KEY secret (server-side only — never sent to or
// readable from the client). If it's missing, or the call fails for any reason,
// this responds with a non-2xx status and a generic message. The client's
// `fetchGrowGuidance` treats every failure the same way: silently fall back to
// the keyword-matched templates in lib/growGuidance.ts. There is no
// user-facing failure mode either way.
//
// Logging note: failures are logged to the function logs with a short reason
// and, where useful, the upstream status code. Two things are never logged —
// the API key (`redact()` below is the backstop) and the couple's Grow notes,
// which are the most private text in the app.

import { corsHeaders } from '../_shared/cors.ts';

interface GrowSuggestion {
  id: string;
  text: string;
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const MODEL = 'gpt-4o-mini';

/** Cap the upstream call so the function can't outlive the client's own timeout. */
const OPENAI_TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `You help a couple turn tonight's private "Grow" reflections into a small amount of warm, useful guidance.

Both partners privately wrote one short note about something they'd like to grow toward in the relationship. You'll be given both notes. Write 2-3 suggestions in response.

Rules:
- Warm, soft, and specific — never clinical, generic, or like a therapist's checklist.
- Never quote either partner's words back at them, and never assume which partner wrote which note.
- Never sound like you are diagnosing a problem. Frame everything as a small, doable next step, not a correction.
- Ground each suggestion in the actual theme of what they wrote — don't default to generic relationship advice if the notes point somewhere specific.
- Each suggestion is one sentence, plain language, no therapy jargon, no exclamation points.
- Respond with ONLY a JSON object shaped like {"suggestions": [{"id": string, "text": string}, ...]} containing 2-3 items. No prose, no markdown fences, nothing else.`;

/**
 * Belt-and-braces scrub before anything reaches the logs. Nothing here is
 * expected to contain a key — this exists so that a future change that starts
 * logging an upstream body can't quietly leak one.
 */
function redact(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***');
}

function logFailure(reason: string, detail?: unknown): void {
  const extra =
    detail instanceof Error ? detail.message : typeof detail === 'string' ? detail : '';
  console.error(`[grow-guidance] ${reason}${extra ? `: ${redact(extra)}` : ''}`);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Coerce the model's reply into at most three well-formed suggestions.
 * Mirrors `normalizeSuggestions` in lib/growGuidance.ts — anything malformed is
 * dropped rather than returned, so a bad response becomes a clean fallback on
 * the client instead of a half-rendered card.
 */
export function normalizeSuggestions(raw: unknown): GrowSuggestion[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { suggestions?: unknown })?.suggestions)
      ? (raw as { suggestions: unknown[] }).suggestions
      : [];

  return list
    .filter((s): s is { id?: unknown; text: string } =>
      Boolean(s) &&
      typeof (s as { text?: unknown }).text === 'string' &&
      (s as { text: string }).text.trim().length > 0)
    .slice(0, 3)
    .map((s, i) => ({
      id: typeof s.id === 'string' && s.id.trim() ? s.id : `ai-${i}`,
      text: s.text.trim(),
    }));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      logFailure('OPENAI_API_KEY is not configured — set it with `supabase secrets set`');
      return json({ error: 'Guidance is not configured.' }, 501);
    }

    let growTexts: unknown;
    try {
      ({ growTexts } = (await req.json()) as { growTexts?: unknown });
    } catch {
      logFailure('request body was not valid JSON');
      return json({ error: 'Invalid request body.' }, 400);
    }

    const notes = (Array.isArray(growTexts) ? growTexts : [])
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)
      // One note per partner; a long note is trimmed rather than rejected.
      .slice(0, 2)
      .map((t) => t.slice(0, 1000));

    if (notes.length === 0) {
      return json({ suggestions: [] });
    }

    const userContent = notes
      .map((note, i) => `Partner ${i + 1}'s Grow note: "${note}"`)
      .join('\n');

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 400,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        }),
        signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      });
    } catch (err) {
      // Network failure or the 10s timeout above.
      logFailure('OpenAI request did not complete', err);
      return json({ error: 'Guidance is unavailable right now.' }, 502);
    }

    if (!response.ok) {
      // The status is the useful part; the body can hold request echoes, so it
      // is logged redacted and never returned to the client.
      const body = await response.text().catch(() => '');
      logFailure(`OpenAI responded ${response.status}`, body.slice(0, 500));
      return json({ error: 'Guidance is unavailable right now.' }, 502);
    }

    let suggestions: GrowSuggestion[];
    try {
      const data = await response.json();
      const raw: string = data?.choices?.[0]?.message?.content ?? '';
      suggestions = normalizeSuggestions(JSON.parse(raw.trim()));
    } catch (err) {
      logFailure('could not parse the model response', err);
      return json({ error: 'Guidance is unavailable right now.' }, 502);
    }

    if (suggestions.length === 0) {
      logFailure('model returned no usable suggestions');
      return json({ error: 'Guidance is unavailable right now.' }, 502);
    }

    return json({ suggestions });
  } catch (err) {
    logFailure('unhandled error', err);
    return json({ error: 'Guidance is unavailable right now.' }, 500);
  }
});
