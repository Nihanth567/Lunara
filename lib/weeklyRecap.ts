/**
 * "Your week" — the last seven nights, read back as four short lists.
 *
 * What you were grateful for, what you found cute, what you want to grow, and
 * (on the screen, from `fetchGrowGuidance`) how to grow it. The couple's own
 * words, gathered — nothing counted, nothing scored.
 *
 * Pure and derived from `entries`, like the streak: there is no recap to
 * store, so there is no recap that can go stale.
 *
 * Which nights count:
 *  - only nights you *both* finished — a half night has nothing to read back
 *  - never tonight until you have opened it together. The recap must not
 *    become a side door past the reveal.
 */

export interface RecapEntry {
  date: string;
  submitted: boolean;
  partnerSubmitted: boolean;
  revealed?: boolean;
  grateful: string;
  cute: string;
  grow: string;
  partnerGrateful: string;
  partnerCute: string;
  partnerGrow: string;
  voiceGrateful?: string | null;
  voiceCute?: string | null;
  voiceGrow?: string | null;
  partnerVoiceGrateful?: string | null;
  partnerVoiceCute?: string | null;
  partnerVoiceGrow?: string | null;
  voiceGratefulDurationMs?: number | null;
  voiceCuteDurationMs?: number | null;
  voiceGrowDurationMs?: number | null;
  partnerVoiceGratefulDurationMs?: number | null;
  partnerVoiceCuteDurationMs?: number | null;
  partnerVoiceGrowDurationMs?: number | null;
}

export interface RecapLine {
  date: string;
  who: 'me' | 'partner';
  /** May be empty when the answer was spoken rather than written. */
  text: string;
  voice: string | null;
  voiceDurationMs: number | null;
}

export interface WeekRecap {
  /** Nights both of you finished in the window. */
  nights: number;
  grateful: RecapLine[];
  cute: RecapLine[];
  grow: RecapLine[];
}

const DAY_MS = 86_400_000;

function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

function line(
  date: string,
  who: 'me' | 'partner',
  text: string,
  voice: string | null | undefined,
  voiceDurationMs: number | null | undefined,
): RecapLine | null {
  const trimmed = text.trim();
  if (!trimmed && !voice) return null;
  return { date, who, text: trimmed, voice: voice ?? null, voiceDurationMs: voiceDurationMs ?? null };
}

/**
 * The recap for the seven nights ending on `todayKey` (inclusive), newest
 * first, yours before theirs within a night.
 */
export function weekRecap(entries: RecapEntry[], todayKey: string, days = 7): WeekRecap {
  const earliest = shiftDate(todayKey, -(days - 1));

  const nights = entries
    .filter((e) => e.submitted && e.partnerSubmitted)
    .filter((e) => e.date >= earliest && e.date <= todayKey)
    .filter((e) => e.date !== todayKey || e.revealed === true)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const pick = (lines: (RecapLine | null)[]) => lines.filter((l): l is RecapLine => l !== null);

  return {
    nights: nights.length,
    grateful: pick(
      nights.flatMap((e) => [
        line(e.date, 'me', e.grateful, e.voiceGrateful, e.voiceGratefulDurationMs),
        line(e.date, 'partner', e.partnerGrateful, e.partnerVoiceGrateful, e.partnerVoiceGratefulDurationMs),
      ]),
    ),
    cute: pick(
      nights.flatMap((e) => [
        line(e.date, 'me', e.cute, e.voiceCute, e.voiceCuteDurationMs),
        line(e.date, 'partner', e.partnerCute, e.partnerVoiceCute, e.partnerVoiceCuteDurationMs),
      ]),
    ),
    grow: pick(
      nights.flatMap((e) => [
        line(e.date, 'me', e.grow, e.voiceGrow, e.voiceGrowDurationMs),
        line(e.date, 'partner', e.partnerGrow, e.partnerVoiceGrow, e.partnerVoiceGrowDurationMs),
      ]),
    ),
  };
}
