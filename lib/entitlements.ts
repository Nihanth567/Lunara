import type { Couple } from '@/context/AppContext';
import { toDateKey } from '@/lib/streak';

/**
 * How many trailing days of completed prompts free users can see in Moments.
 *
 * This was 7, which meant a couple's archive quietly evaporated a week after
 * they wrote it. The archive is the emotional reason anyone keeps doing the
 * ritual — showing someone that last Tuesday is already locked teaches them
 * their words aren't safe here, which costs far more than it converts. A month
 * is long enough to feel kept and still short enough that a couple with real
 * history has an honest reason to unlock the rest.
 *
 * The paywall reads this constant rather than restating a number, so changing
 * it here keeps every claim about the free tier true.
 */
export const FREE_HISTORY_DAYS = 30;

export function isPro(couple: Couple | null): boolean {
  return couple?.isSubscribed ?? false;
}

/**
 * What Lunara Pro is — the single list the paywall, the Us tab and the
 * onboarding preview all render from.
 *
 * Every entry here must correspond to a gate that exists in the code. The
 * paywall used to keep its own copy and sold three things the app has never
 * had: lock-screen widgets (the WidgetKit target declares `.systemSmall` only),
 * photo keepsakes (the button alerts "coming soon"), and "special prompt packs"
 * (nothing in the app at all). Three surfaces each describing Pro in their own
 * words is how that happens, so now there is one description and the gates are
 * named beside it.
 *
 * Deliberately absent: Grow guidance and the nightly ritual itself. Both are
 * free for everyone, so neither is a reason to subscribe — and listing a free
 * feature as a paid one is the same lie in the other direction.
 */
export interface ProFeature {
  /** Ionicons name. */
  icon: string;
  /** The full line, as the paywall lists it. */
  text: string;
  /** Two or three words, for the places that name Pro in a sentence. */
  short: string;
  /** Where the gate for this actually lives, so the claim stays checkable. */
  gate: string;
}

export const PRO_FEATURES: ProFeature[] = [
  {
    icon: 'infinite-outline',
    text: `Your whole archive — every night, not just the last ${FREE_HISTORY_DAYS} days`,
    short: 'your whole archive',
    gate: 'app/(app)/history.tsx — freeHistoryCutoffDate()',
  },
  {
    icon: 'mic-outline',
    text: 'Voice notes on any of tonight’s three answers',
    short: 'voice notes',
    gate: 'app/(app)/index.tsx — onRecordVoice / onVoiceLocked',
  },
  {
    icon: 'sparkles-outline',
    text: 'Your full weekly recap, with the insights behind the numbers',
    short: 'your full weekly recap',
    gate: 'components/WeeklyRecapCard.tsx',
  },
  {
    icon: 'heart-outline',
    text: 'The complete date-night playbook across all three themes',
    short: 'the complete date-night playbook',
    gate: 'components/DateNightSection.tsx',
  },
];

/**
 * One sentence naming everything Pro unlocks, for the places that describe the
 * subscription in prose rather than as a list (the Us tab, the preview screen).
 * Built from `PRO_FEATURES` rather than written out again, so removing a feature
 * removes it from every sentence that mentions it.
 */
export function proFeatureSummary(): string {
  const parts = PRO_FEATURES.map((f) => f.short);
  const last = parts[parts.length - 1];
  const sentence = `${parts.slice(0, -1).join(', ')}, and ${last}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/**
 * What the free tier keeps, stated plainly enough to sit on the paywall.
 * The archive limit is the one Pro claim that is also a *restriction*, so it has
 * to appear as both — the paywall says what Pro adds, and this says what free
 * never loses. Neither is allowed to contradict the other.
 */
export function freeTierSummary(): string {
  return `The nightly ritual, the reveal, your streak, and your last ${FREE_HISTORY_DAYS} days of Moments stay free for both of you, always.`;
}

/** Oldest date (YYYY-MM-DD) still visible to a free user in the Moments feed. */
export function freeHistoryCutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - (FREE_HISTORY_DAYS - 1));
  return toDateKey(d);
}
