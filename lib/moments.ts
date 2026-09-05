import type { DailyEntry } from '@/context/AppContext';

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
  color: string;
  mine: string;
  theirs: string;
  myVoice: string | null;
  theirVoice: string | null;
}

/** Both partners' answers for a night, grouped by prompt, in ritual order. */
export function momentSections(entry: DailyEntry): MomentSection[] {
  return [
    {
      key: 'grateful',
      title: 'Grateful',
      color: '#FF9A8B',
      mine: entry.grateful,
      theirs: entry.partnerGrateful,
      myVoice: entry.voiceGrateful ?? null,
      theirVoice: entry.partnerVoiceGrateful ?? null,
    },
    {
      key: 'cute',
      title: 'Cute',
      color: '#C3B1E1',
      mine: entry.cute,
      theirs: entry.partnerCute,
      myVoice: entry.voiceCute ?? null,
      theirVoice: entry.partnerVoiceCute ?? null,
    },
    {
      key: 'grow',
      title: 'Grow',
      color: '#A8D8A8',
      mine: entry.grow,
      theirs: entry.partnerGrow,
      myVoice: entry.voiceGrow ?? null,
      theirVoice: entry.partnerVoiceGrow ?? null,
    },
  ];
}
