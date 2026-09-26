// Supabase Edge Function: transcribe-voice
//
// Turns one of the caller's own voice notes into text, so they can drop it into
// the written line on the same card and edit it. Called from
// `transcribeVoiceNote()` in lib/voiceNotes.ts.
//
// POST body: { path: string }   — a Storage path in the private voice-notes
//                                 bucket, never a URL and never raw audio.
//
// Requires the OPENAI_API_KEY secret. Server-side only: the key is never sent
// to, or readable from, the client. That is the entire reason this is a
// function and not a fetch from the app.
//
// ─── What this refuses to do ─────────────────────────────────────────────────
//
// You may only transcribe *your own* recording. Not your partner's — not even
// after the reveal gate has opened.
//
// The path arrives from the client, so it is untrusted input, and the obvious
// bug to write here is to accept it and hand it to a service-role download.
// That would turn this function into an oracle that reads any object in the
// bucket for anyone with a session: pass a partner's path before either of you
// has submitted and the function would happily read tonight's answer aloud,
// straight through the reveal gate the whole app is built around.
//
// So the path is parsed and checked against the caller (below), *and* the
// download runs as the caller rather than as the service role, so Storage RLS
// is a second independent gate on the same question. Either check alone would
// be enough; neither is trusted to be.
//
// ─── Logging ─────────────────────────────────────────────────────────────────
//
// Two things are never logged: the API key, and the transcript or audio. A
// voice note is the most private thing in this app — it is someone's voice
// saying something tender to one other person. Failures log a reason and a
// status code, nothing else.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const VOICE_BUCKET = 'voice-notes';

/**
 * `whisper-1` rather than one of the newer `gpt-4o-*-transcribe` models: it is
 * available on every account with API access, which a model gated by tier is
 * not. Swapping it is a one-line change if that stops being true.
 */
const MODEL = 'whisper-1';

/** Cap the upstream call so this can't outlive the client's own patience. */
const OPENAI_TIMEOUT_MS = 30000;

/**
 * Mirrors the bucket's own `file_size_limit`. A recording is capped at 90
 * seconds client-side and lands around 1.5 MB at most, so anything near this
 * is not a voice note and should not be paid for.
 */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Backstop against a future change that starts logging an upstream body. */
function redact(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***');
}

function logFailure(reason: string, detail?: unknown): void {
  const extra =
    detail instanceof Error ? detail.message : typeof detail === 'string' ? detail : '';
  console.error(`[transcribe-voice] ${reason}${extra ? `: ${redact(extra)}` : ''}`);
}

interface ParsedPath {
  coupleId: string;
  date: string;
  userId: string;
  /** The validated path itself, so nothing downstream re-reads the raw input. */
  path: string;
}

/**
 * Split `{couple_id}/{date}/{user_id}/{slot}.m4a` into its parts, or null if it
 * isn't that shape.
 *
 * Strict on purpose. The segments are matched against explicit patterns rather
 * than merely counted, so a path containing `..`, a leading slash, or an
 * unexpected number of segments is rejected here rather than being handed to
 * Storage to interpret.
 */
export function parseVoiceNotePath(path: unknown): ParsedPath | null {
  if (typeof path !== 'string' || path.length === 0 || path.length > 256) return null;

  const segments = path.split('/');
  if (segments.length !== 4) return null;

  const [coupleId, date, userId, file] = segments;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuid.test(coupleId)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!uuid.test(userId)) return null;
  if (!/^(grateful|cute|grow)\.m4a$/.test(file)) return null;

  return { coupleId, date, userId, path };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!OPENAI_API_KEY) {
    logFailure('missing OPENAI_API_KEY');
    return json({ error: 'Transcription is not configured' }, 503);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    // Scoped to the caller's JWT — used both to establish who is calling and,
    // below, to download the object under their own RLS.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return json({ error: 'Invalid or expired session' }, 401);
    }

    const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
    const parsed = parseVoiceNotePath(body?.path);
    if (!parsed) {
      return json({ error: 'A valid voice note path is required' }, 400);
    }

    // Gate 1: your own recording only. See the note at the top of this file —
    // this is what stops the function being used to read a partner's answer
    // before the reveal.
    if (parsed.userId !== caller.id) {
      return json({ error: 'You can only transcribe your own voice note' }, 403);
    }

    // Gate 2: the couple in the path is one you actually belong to. Read under
    // the caller's own RLS, so a couple they are not in returns nothing.
    const { data: membership, error: membershipError } = await callerClient
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', parsed.coupleId)
      .eq('user_id', caller.id)
      .maybeSingle();
    if (membershipError) {
      logFailure('membership lookup failed', membershipError.message);
      return json({ error: 'Could not verify couple membership' }, 500);
    }
    if (!membership) {
      return json({ error: 'You do not belong to this couple' }, 403);
    }

    // Gate 3: Storage RLS, as the caller. Independent of both checks above.
    const { data: blob, error: downloadError } = await callerClient.storage
      .from(VOICE_BUCKET)
      .download(parsed.path);
    if (downloadError || !blob) {
      logFailure('download failed', downloadError?.message);
      return json({ error: 'That recording could not be read' }, 404);
    }
    if (blob.size === 0 || blob.size > MAX_AUDIO_BYTES) {
      return json({ error: 'That recording is not a voice note' }, 400);
    }

    const form = new FormData();
    form.append('file', blob, 'note.m4a');
    form.append('model', MODEL);
    // `json` rather than `verbose_json`: nothing here wants segments or
    // timestamps, and the smaller response is one less thing to parse.
    form.append('response_format', 'json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      // Status only. The body can echo request content, and the request
      // content here is someone's voice.
      logFailure('upstream rejected', `status ${upstream.status}`);
      return json({ error: 'Transcription failed' }, 502);
    }

    const result = (await upstream.json()) as { text?: unknown };
    const transcript = typeof result.text === 'string' ? result.text.trim() : '';

    // An empty transcript is a legitimate outcome — silence, or a recording
    // with no speech in it. It is returned as an empty string with a 200 so the
    // client can say "we couldn't make that out" rather than "something broke".
    return json({ transcript });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      logFailure('upstream timed out');
      return json({ error: 'Transcription timed out' }, 504);
    }
    logFailure('unhandled', error);
    return json({ error: 'Transcription failed' }, 500);
  }
});
