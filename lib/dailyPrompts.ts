/**
 * Tonight's three questions — a new wording every night, the same three cards.
 *
 * Grateful / Cute / Grow never change: they are the shape of the ritual, and a
 * couple should never have to learn a new screen. What changes is the question
 * each card asks, so night forty doesn't read exactly like night one.
 *
 * Derived from the date, never stored. Both partners compute the same question
 * for the same night without a round trip, and a past night shows the question
 * that was actually asked on it — the same "derived, never stored" rule the
 * streak and the list follow.
 *
 * The three pools are 9, 8 and 7 long on purpose. Equal lengths would lock the
 * cards together, so every Tuesday would ask the same three things; co-prime-ish
 * lengths give 504 nights before a combination repeats.
 *
 * Tone: questions about *them*, small and specific, answerable in one line or
 * one breath. Nothing that sets a bar ("share something meaningful"), nothing
 * that sounds like therapy homework.
 */

export type PromptType = 'grateful' | 'cute' | 'grow';

export const PROMPTS: Record<PromptType, readonly string[]> = {
  grateful: [
    'What did they do today that you’re thankful for?',
    'What small thing made your day easier?',
    'When did you feel lucky to have them today?',
    'What did they say that stuck with you?',
    'What habit of theirs are you quietly grateful for?',
    'How did they show up for you this week?',
    'What would today have missed without them?',
    'What’s something they did that nobody saw but you?',
    'What about them felt like home today?',
  ],
  cute: [
    'What made you smile about them today?',
    'What’s something silly they did recently?',
    'What face do they make that you love?',
    'What tiny moment today felt like “us”?',
    'What inside joke is living rent-free in your head?',
    'When did they look especially cute today?',
    'What do they do that’s adorable and they don’t know it?',
    'What would you brag about them to a friend?',
  ],
  grow: [
    'What’s one small thing you could try together tomorrow?',
    'Where could you both use a little more patience?',
    'What would make this week feel easier for you two?',
    'What would you like to do more of together?',
    'Is there anything you’d like to talk about soon?',
    'How could you help them feel a little more loved?',
    'What’s one thing you’d like to get better at, together?',
  ],
};

/** Days since 1970-01-01 for a `YYYY-MM-DD` key, in UTC so a timezone can't shift it. */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** The question a card asks on a given night. Same date in, same question out. */
export function dailyPrompt(type: PromptType, dateKey: string): string {
  const pool = PROMPTS[type];
  const day = dayNumber(dateKey);
  if (!Number.isFinite(day)) return pool[0];
  // `%` can go negative for dates before 1970; fold it back into range.
  return pool[((day % pool.length) + pool.length) % pool.length];
}
