/**
 * Together points — one point for every night the two of you finished.
 *
 * ─── Why this is not a counter ───────────────────────────────────────────────
 *
 * The obvious implementation is `points += 1` when a night completes. That is
 * also the one implementation this codebase has already decided against twice:
 * streaks are recomputed from the set of completed dates (`lib/streak.ts`), and
 * list completion is resolved from check rows rather than a `done` column
 * (`lib/list.ts`). The reason is the same every time — an incremented number is
 * a second source of truth, and the moment it disagrees with the entries it was
 * counting there is no way to tell which one is wrong.
 *
 * A derived total cannot drift. A night that is un-submitted, a partner who
 * joins late and backfills, a realtime event that arrives twice, a retried
 * upsert — none of them can inflate this, because it is not a tally of events,
 * it is `|{ nights both of you finished }|`.
 *
 * ─── Why one point, and nothing to spend it on ───────────────────────────────
 *
 * Points here are a *record*, not a currency. There is no shop, no streak
 * freeze to buy, no tier to unlock, and adding one later should be treated as a
 * product decision rather than an extension of this file. The number exists to
 * say "this many nights happened" in a form that keeps climbing after a streak
 * breaks — which is the whole point of having it next to a streak. A couple who
 * missed a Tuesday loses their run; they do not lose the forty nights that
 * came before it, and this is the number that says so.
 *
 * That is also why there is no penalty, no decay, and no way for this to go
 * down. A number that can fall is a number that can punish.
 */

/** The shape both this and `completedDates()` in `lib/streak.ts` read. */
export interface TogetherPointsEntry {
  date: string;
  submitted: boolean;
  partnerSubmitted: boolean;
}

/**
 * Total points for a couple: one per night both partners submitted.
 *
 * Deduplicates by date, so a malformed entry list (two rows for one night —
 * possible in demo mode, where the store is a plain array) counts once rather
 * than twice.
 */
export function togetherPoints(entries: TogetherPointsEntry[]): number {
  const nights = new Set<string>();
  for (const entry of entries) {
    if (entry.submitted && entry.partnerSubmitted) nights.add(entry.date);
  }
  return nights.size;
}

/**
 * Whether the chip is worth showing at all.
 *
 * Zero and one are both worse than nothing. "0 points" on a couple's first
 * night is a scoreboard opening at nil, and "1 point" is a scoreboard that has
 * noticed. The number only starts meaning "look how many" once there are a few,
 * and until then the fox and the streak are already saying everything this
 * would say.
 */
export const MIN_POINTS_TO_SHOW = 2;

export function shouldShowTogetherPoints(points: number): boolean {
  return points >= MIN_POINTS_TO_SHOW;
}

/**
 * The chip's text. Plural-correct, and phrased as nights rather than as a
 * score — "48 nights together" is a fact about them, "48 points" is a game.
 */
export function togetherPointsLabel(points: number): string {
  return `${points} ${points === 1 ? 'night' : 'nights'} together`;
}
