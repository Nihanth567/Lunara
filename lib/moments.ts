import type { DailyEntry } from '@/context/AppContext';
import { promptAccent } from '@/constants/colors';
import { dailyPrompt } from '@/lib/dailyPrompts';

/**
 * Small pure helpers shared by the Moments list and a single moment's detail
 * screen. Kept out of the components so both agree on what counts as a moment.
 */

/**
 * A night belongs in Moments only once both partners submitted it — that's the
 * same condition the reveal gate uses, so the list can never promise a night
 * whose contents the server won't return.
 */
export function momentIsComplete(entry: DailyEntry): boolean {
  return entry.submitted && entry.partnerSubmitted;
}

/** How many voice notes exist across both partners for this night. */
export function momentVoiceCount(entry: DailyEntry): number {
  return [
    entry.voiceGrateful,
    entry.voiceCute,
    entry.voiceGrow,
    entry.partnerVoiceGrateful,
    entry.partnerVoiceCute,
    entry.partnerVoiceGrow,
  ].filter(Boolean).length;
}

/** "Today" / "Yesterday" / "Tuesday" / "March 4" — closest thing to how people refer to a night. */
export function formatMomentDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/** Full date line for the detail header, e.g. "Tuesday, March 4, 2026". */
export function formatMomentDateLong(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface MomentSection {
  key: 'grateful' | 'cute' | 'grow';
  title: string;
  /** The question that card asked on this night. */
  question: string;
  color: string;
  mine: string;
  theirs: string;
  myVoice: string | null;
  theirVoice: string | null;
  /** Lengths, so a past night's players read "0:14" rather than "Voice note". */
  myVoiceDurationMs: number | null;
  theirVoiceDurationMs: number | null;
}

/** Both partners' answers for a night, grouped by prompt, in ritual order. */
export function momentSections(entry: DailyEntry): MomentSection[] {
  return [
    {
      key: 'grateful',
      question: dailyPrompt('grateful', entry.date),
      title: 'Grateful',
      color: promptAccent.grateful,
      mine: entry.grateful,
      theirs: entry.partnerGrateful,
      myVoice: entry.voiceGrateful ?? null,
      theirVoice: entry.partnerVoiceGrateful ?? null,
      myVoiceDurationMs: entry.voiceGratefulDurationMs ?? null,
      theirVoiceDurationMs: entry.partnerVoiceGratefulDurationMs ?? null,
    },
    {
      key: 'cute',
      question: dailyPrompt('cute', entry.date),
      title: 'Cute',
      color: promptAccent.cute,
      mine: entry.cute,
      theirs: entry.partnerCute,
      myVoice: entry.voiceCute ?? null,
      theirVoice: entry.partnerVoiceCute ?? null,
      myVoiceDurationMs: entry.voiceCuteDurationMs ?? null,
      theirVoiceDurationMs: entry.partnerVoiceCuteDurationMs ?? null,
    },
    {
      key: 'grow',
      question: dailyPrompt('grow', entry.date),
      title: 'Grow',
      color: promptAccent.grow,
      mine: entry.grow,
      theirs: entry.partnerGrow,
      myVoice: entry.voiceGrow ?? null,
      theirVoice: entry.partnerVoiceGrow ?? null,
      myVoiceDurationMs: entry.voiceGrowDurationMs ?? null,
      theirVoiceDurationMs: entry.partnerVoiceGrowDurationMs ?? null,
    },
  ];
}
