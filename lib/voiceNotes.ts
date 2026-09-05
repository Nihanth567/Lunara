import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';

/**
 * Voice notes for the nightly ritual.
 *
 * A recording lives in the private `voice-notes` Storage bucket at
 * `{couple_id}/{date}/{user_id}/{slot}.m4a`, and the entry row keeps only that
 * path — never a URL. Playback always goes through a short-lived signed URL, so
 * a path on its own grants nothing, and the bucket's RLS mirrors the reveal
 * gate on `entries`: your own recording is always yours, a partner's only opens
 * once you have both submitted that date.
 *
 * Demo couples have no server. There, the local `file://` URI *is* the stored
 * value — `isLocalVoiceNote` is what tells the two apart everywhere else.
 */

export type VoiceSlot = 'grateful' | 'cute' | 'grow';

export const VOICE_BUCKET = 'voice-notes';

/** Long enough for a real thought, short enough to stay a note and not a monologue. */
export const VOICE_NOTE_MAX_SECONDS = 120;

/** How long a playback URL stays valid. Long enough to listen, short enough to not be a handle. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function voiceNotePath(
  coupleId: string,
  date: string,
  userId: string,
  slot: VoiceSlot,
): string {
  return `${coupleId}/${date}/${userId}/${slot}.m4a`;
}

/** Demo-mode recordings are kept as on-device file URIs rather than Storage paths. */
export function isLocalVoiceNote(pathOrUri: string): boolean {
  return pathOrUri.startsWith('file://') || pathOrUri.startsWith('/');
}

/**
 * Upload a finished recording, replacing any previous take for the same slot.
 * Returns the Storage path to persist on the entry row.
 */
export async function uploadVoiceNote(params: {
  coupleId: string;
  date: string;
  userId: string;
  slot: VoiceSlot;
  localUri: string;
}): Promise<string> {
  const { coupleId, date, userId, slot, localUri } = params;
  const path = voiceNotePath(coupleId, date, userId, slot);

  // `File` implements Blob, so this reads the recording without a base64 round
  // trip — RN's Blob can't be uploaded directly, but an ArrayBuffer can.
  const bytes = await new File(localUri).arrayBuffer();

  const { error } = await supabase.storage.from(VOICE_BUCKET).upload(path, bytes, {
    contentType: 'audio/m4a',
    upsert: true,
  });
  if (error) throw new Error(error.message);

  return path;
}

/**
 * A playable URL for a stored note, or null if it can't be resolved (deleted
 * file, expired session, or the reveal gate still closed). Callers treat null
 * as "no audio to offer" rather than an error — a missing voice note should
 * never break the surrounding screen.
 */
export async function getVoiceNoteUrl(pathOrUri: string): Promise<string | null> {
  if (isLocalVoiceNote(pathOrUri)) {
    // Demo recordings sit in the app cache, which the OS may clear. Check
    // before handing the path to a player, so a cleared file renders as "no
    // voice note" rather than a spinner that never resolves.
    try {
      return new File(pathOrUri).exists ? pathOrUri : null;
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(pathOrUri, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Remove a recording. Best-effort — a failure here must not block the ritual. */
export async function deleteVoiceNote(pathOrUri: string): Promise<void> {
  if (isLocalVoiceNote(pathOrUri)) {
    try {
      new File(pathOrUri).delete();
    } catch {
      // Already gone, or the sandbox cleared it — nothing to undo.
    }
    return;
  }
  await supabase.storage.from(VOICE_BUCKET).remove([pathOrUri]).catch(() => {});
}

/** `0:07`, `1:42` — duration for a recorder or player readout. */
export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
