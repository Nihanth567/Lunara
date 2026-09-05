import { toDateKey } from '@/lib/streak';
/**
 * Growth module data — daily growth tips, date-night ideas, and weekly recap
 * copy. All pure/deterministic so the UI stays testable; stateful bits (what's
 * been viewed, follow-up answers, the Connection Streak) live in
 * `hooks/useGrowth.ts` on top of AsyncStorage.
 *
 * Swap the bodies of `getDailyGrowthTip` / `buildWeeklyRecap` for an LLM call
 * later — the signatures are all the UI depends on.
 */

// ─── Daily growth tips ───────────────────────────────────────────────────────

export interface GrowthTip {
  id: string;
  /** Short topic label shown as an eyebrow, e.g. "Presence". */
  topic: string;
  /** One brief, actionable suggestion. */
  tip: string;
}

/**
 * Curated pool. `getDailyGrowthTip` picks one deterministically per date so a
 * given day always shows the same tip for both partners, and "yesterday's tip"
 * can be looked up again for the follow-up card.
 */
export const DAILY_GROWTH_TIPS: GrowthTip[] = [
  { id: 'presence-phones', topic: 'Presence', tip: 'Put both phones in another room for the first 20 minutes you’re together tonight.' },
  { id: 'listening-echo', topic: 'Listening', tip: 'Next time they share something, reflect it back in one sentence before you respond.' },
  { id: 'appreciation-specific', topic: 'Appreciation', tip: 'Tell them one specific thing they did this week that made your day easier.' },
  { id: 'affection-tensec', topic: 'Affection', tip: 'Share one long hug — count to ten before you let go.' },
  { id: 'curiosity-question', topic: 'Curiosity', tip: 'Ask one question tonight you’ve never asked them before.' },
  { id: 'repair-checkin', topic: 'Repair', tip: 'If something felt off today, name it gently now rather than letting it settle.' },
  { id: 'play-tiny', topic: 'Playfulness', tip: 'Do one small silly thing together — a dumb dance, a bad pun, a race to the couch.' },
  { id: 'support-ask', topic: 'Support', tip: 'Ask, “What would actually feel like support this week?” and just listen to the answer.' },
  { id: 'gratitude-outloud', topic: 'Gratitude', tip: 'Say one thing you’re grateful for about them out loud before you fall asleep.' },
  { id: 'future-small', topic: 'Shared future', tip: 'Spend five minutes planning one small thing to look forward to together.' },
  { id: 'space-honor', topic: 'Space', tip: 'Give them 15 quiet minutes to decompress before diving into conversation.' },
  { id: 'touchpoint-midday', topic: 'Connection', tip: 'Send one message tomorrow midday that isn’t about logistics.' },
  { id: 'kindness-note', topic: 'Kindness', tip: 'Leave a short note somewhere they’ll find it tomorrow morning.' },
  { id: 'conflict-soften', topic: 'Communication', tip: 'Start one hard sentence with “I’ve been feeling…” instead of “you always…”' },
];

function hashDate(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic tip for a given YYYY-MM-DD date. */
export function getDailyGrowthTip(date: string): GrowthTip {
  return DAILY_GROWTH_TIPS[hashDate(date) % DAILY_GROWTH_TIPS.length];
}

// ─── Date-night ideas ────────────────────────────────────────────────────────

export type DateTheme = 'Cozy' | 'Outdoor' | 'Conversational';

export const DATE_THEMES: DateTheme[] = ['Cozy', 'Outdoor', 'Conversational'];

export interface DateIdea {
  id: string;
  theme: DateTheme;
  title: string;
  description: string;
  /** Rough time to set aside. */
  duration: string;
}

export const DATE_IDEAS: DateIdea[] = [
  // Cozy
  { id: 'cozy-1', theme: 'Cozy', title: 'Blanket-fort movie night', description: 'Build a fort, pick a film neither of you has seen, no second screens.', duration: '2 hrs' },
  { id: 'cozy-2', theme: 'Cozy', title: 'Cook one dish together', description: 'One recipe, one kitchen, phones on a playlist. Slow it down.', duration: '90 min' },
  { id: 'cozy-3', theme: 'Cozy', title: 'Bakery crawl at home', description: 'Each secretly buy the other’s favorite pastry, then trade over coffee.', duration: '45 min' },
  { id: 'cozy-4', theme: 'Cozy', title: 'Candlelit playlist swap', description: 'Take turns playing three songs that meant something to you at 17.', duration: '1 hr' },
  // Outdoor
  { id: 'out-1', theme: 'Outdoor', title: 'Golden-hour walk', description: 'Leave 40 minutes before sunset, walk a route you’ve never taken.', duration: '1 hr' },
  { id: 'out-2', theme: 'Outdoor', title: 'Farmers-market breakfast', description: 'Pick ingredients together, then make breakfast from whatever you found.', duration: '2 hrs' },
  { id: 'out-3', theme: 'Outdoor', title: 'Stargazing with a thermos', description: 'Drive somewhere dark, bring a warm drink, name constellations badly.', duration: '90 min' },
  { id: 'out-4', theme: 'Outdoor', title: 'Rent bikes, no destination', description: 'Flip a coin at every intersection for the first half hour.', duration: '2 hrs' },
  // Conversational
  { id: 'conv-1', theme: 'Conversational', title: 'Highs & lows dinner', description: 'No phones. Each share your high, low, and one thing you’re curious about.', duration: '1 hr' },
  { id: 'conv-2', theme: 'Conversational', title: '36 questions, part one', description: 'Work through the first set of the classic closeness questions.', duration: '1 hr' },
  { id: 'conv-3', theme: 'Conversational', title: 'Future-us interview', description: 'Take turns interviewing each other about life five years from now.', duration: '45 min' },
  { id: 'conv-4', theme: 'Conversational', title: 'Map your origin story', description: 'Retell how you met, each filling in details the other forgot.', duration: '45 min' },
];

/** Two teaser cards shown to free users. */
export const PREVIEW_DATE_IDEAS: DateIdea[] = [DATE_IDEAS[0], DATE_IDEAS[4]];

// ─── Weekly recap ────────────────────────────────────────────────────────────

/** Sunday-anchored start (YYYY-MM-DD) of the week containing `date`. */
export function startOfWeek(date: string): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return toDateKey(d);
}

export function isSunday(date: string): boolean {
  return new Date(date + 'T00:00:00').getDay() === 0;
}

export interface WeeklyRecap {
  weekStart: string;
  tipsViewed: number;
  tipsTried: number;
  promptsCompleted: number;
  /** One-sentence teaser for free users. */
  teaser: string;
  /** Fuller insight + next-week nudges for Pro users. */
  proInsights: string[];
}

interface RecapInput {
  /** Date the recap is being viewed (YYYY-MM-DD). */
  today: string;
  /** Dates (YYYY-MM-DD) a growth tip was opened this week. */
  viewedTipDates: string[];
  /** Dates a follow-up was answered "yes, we did". */
  triedTipDates: string[];
  /** Dates both partners completed the nightly prompt this week. */
  completedPromptDates: string[];
}

export function buildWeeklyRecap(input: RecapInput): WeeklyRecap {
  const weekStart = startOfWeek(input.today);
  const inWeek = (d: string) => startOfWeek(d) === weekStart;

  const tipsViewed = input.viewedTipDates.filter(inWeek).length;
  const tipsTried = input.triedTipDates.filter(inWeek).length;
  const promptsCompleted = input.completedPromptDates.filter(inWeek).length;

  const teaser =
    promptsCompleted === 0
      ? 'A fresh week to reconnect — your first shared night is waiting.'
      : `This week you shared ${promptsCompleted} ${promptsCompleted === 1 ? 'night' : 'nights'} and tried ${tipsTried} growth ${tipsTried === 1 ? 'tip' : 'tips'} together.`;

  const proInsights: string[] = [];
  if (promptsCompleted >= 5) {
    proInsights.push('You kept the ritual almost every night — consistency like this is what compounds into closeness. Protect the same time slot next week.');
  } else if (promptsCompleted >= 2) {
    proInsights.push(`You connected ${promptsCompleted} nights. Pick two evenings in advance for next week so it doesn’t depend on remembering.`);
  } else {
    proInsights.push('It was a light week for the ritual. Start small: aim for two nights, and let the streak rebuild itself.');
  }

  if (tipsViewed > 0) {
    const rate = tipsTried / tipsViewed;
    proInsights.push(
      rate >= 0.6
        ? 'You acted on most of the growth tips you saw — that follow-through is rare. Keep naming what worked out loud.'
        : 'You read more tips than you tried. Next week, pick just one to actually do and skip the rest guilt-free.',
    );
  }

  proInsights.push(
    'For the week ahead: schedule one date from the Cozy or Conversational decks, and revisit any Grow note that keeps resurfacing.',
  );

  return { weekStart, tipsViewed, tipsTried, promptsCompleted, teaser, proInsights };
}
