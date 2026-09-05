/**
 * The Grow check-back: one soft question the day after a couple saw guidance on
 * their Grow notes. Deliberately a single question with three taps and no text
 * field — it's a nudge to notice, not a coaching thread.
 *
 * Pure data and copy only. Which day is pending lives in `hooks/useGrowth.ts`;
 * the answer itself is saved onto that day's entry so it shows up in Moments
 * alongside the notes it's about.
 */

export type GrowFollowUpResponse = 'yes' | 'a_little' | 'not_yet';

export const GROW_CHECK_BACK_QUESTION =
  'Did you try a small step from yesterday’s Grow note?';

export interface GrowFollowUpOption {
  value: GrowFollowUpResponse;
  label: string;
  /** Ionicons name. */
  icon: 'sparkles-outline' | 'leaf-outline' | 'moon-outline';
  color: string;
}

export const GROW_FOLLOW_UP_OPTIONS: GrowFollowUpOption[] = [
  { value: 'yes', label: 'Yes', icon: 'sparkles-outline', color: '#A8D8A8' },
  { value: 'a_little', label: 'A little', icon: 'leaf-outline', color: '#FFD6A5' },
  { value: 'not_yet', label: 'Not yet', icon: 'moon-outline', color: '#C3B1E1' },
];

/** Warm, never disappointed — "not yet" has to feel as safe an answer as "yes". */
export function growFollowUpAcknowledgement(response: GrowFollowUpResponse): string {
  switch (response) {
    case 'yes':
      return 'That counts for a lot. Small steps are the ones that stay.';
    case 'a_little':
      return 'A little is how most things start. That’s worth something.';
    case 'not_yet':
      return 'No pressure at all — it’ll keep. Tonight is its own thing.';
  }
}

/** Short label for the saved reply, shown next to the day it belongs to in Moments. */
export function growFollowUpLabel(response: GrowFollowUpResponse): string {
  return GROW_FOLLOW_UP_OPTIONS.find((o) => o.value === response)?.label ?? '';
}

/** Guard for values coming back off a server row or old local storage. */
export function isGrowFollowUpResponse(value: unknown): value is GrowFollowUpResponse {
  return value === 'yes' || value === 'a_little' || value === 'not_yet';
}

// ─── Which day is pending ────────────────────────────────────────────────────

/** Don't resurface a check-back about a night that's already receded. */
export const CHECK_BACK_MAX_AGE_DAYS = 3;

/** The subset of an entry this selector needs — keeps it independent of AppContext. */
export interface CheckBackCandidate {
  date: string;
  grow: string;
  submitted: boolean;
  partnerSubmitted: boolean;
  growFollowUp?: GrowFollowUpResponse | null;
}

export interface PendingCheckBack {
  date: string;
  growText: string;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000,
  );
}

/**
 * Pick the day to check back on: the most recent past day where guidance was
 * actually shown, the night was completed by both partners, there's a Grow note
 * to refer to, and no reply has been recorded yet.
 *
 * "Already answered" is read off the entry rather than a local flag, so
 * answering on one device — or reinstalling — doesn't ask twice.
 */
export function selectPendingCheckBack(
  seenDates: string[],
  entries: CheckBackCandidate[],
  today: string,
): PendingCheckBack | null {
  const byDate = new Map(entries.map((e) => [e.date, e]));

  const match = [...seenDates]
    .filter((d) => d < today && daysBetween(d, today) <= CHECK_BACK_MAX_AGE_DAYS)
    .sort()
    .reverse()
    .map((d) => byDate.get(d))
    .find((entry): entry is CheckBackCandidate =>
      Boolean(entry) &&
      !entry!.growFollowUp &&
      entry!.grow.trim().length > 0 &&
      entry!.submitted &&
      entry!.partnerSubmitted);

  return match ? { date: match.date, growText: match.grow } : null;
}
