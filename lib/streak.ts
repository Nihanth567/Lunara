/**
 * The shared couple streak — one implementation, used everywhere.
 *
 * Four rules, in order of how much they matter to retention:
 *
 * 1. **A night only counts when both partners submitted.** The streak is the
 *    couple's, not either person's, which is what makes it a shared
 *    commitment rather than a personal score.
 *
 * 2. **Today's streak is anchored to yesterday until tonight is done.** A run
 *    that ends yesterday is still alive at 9am — it is *at risk*, not lost.
 *    Anchoring to `today` instead would show "0 nights" every morning to a
 *    couple on a 40-night run, which reads as punishment for not having
 *    finished a night that hasn't happened yet.
 *
 * 3. **One missed night per run is forgiven.** A single gap is stepped over
 *    once, and only once — a second gap ends the run. This is the softness a
 *    nightly habit needs (one bad Tuesday shouldn't erase two months) without
 *    letting an every-other-night pattern masquerade as a streak.
 *
 *    Forgiveness covers *last night* too. It used to refuse to start on the
 *    anchor itself, so a couple who missed one Tuesday read "0 nights" for the
 *    whole of Wednesday and then jumped to N+1 the moment they finished that
 *    evening — the forgiveness they had been promised arriving a day late, and
 *    only as a surprise. A rule that shows up after the fact is not a rule
 *    anyone can rely on, which is the entire point of having it.
 *
 * 4. **`longest` uses the same rules as `current`.** A high-water mark measured
 *    strictly while the live run is measured with grace can read *lower* than
 *    the run it is supposed to bound — a couple on 41 forgiven nights whose
 *    record says 22. The SQL mirror counted strictly for exactly this reason
 *    and produced exactly this disagreement; both now count the same way.
 *
 * `services/notifications.ts` and the widget both read `atRisk`, so the "your
 * streak is still safe tonight" nudge and the home-screen glance agree with
 * what the app itself is showing.
 *
 * Kept pure and date-string based so it can be unit-reasoned about and so the
 * SQL mirror in `recompute_couple_streaks` can be checked against it by eye.
 */

export interface StreakState {
  /** Nights in the current unbroken (grace-adjusted) run. */
  current: number;
  /** High-water mark across all time. */
  longest: number;
  /** Did both partners finish tonight? */
  todayComplete: boolean;
  /**
   * There is a live run and tonight isn't done yet. The whole loss-aversion
   * surface hangs off this — never rendered as failure, only as "still open".
   */
  atRisk: boolean;
  /** The single missed night this run is currently stepping over, if any. */
  protectedDate: string | null;
  /** Is the one-night forgiveness still unspent for this run? */
  graceAvailable: boolean;
}

export const STREAK_MILESTONES = [7, 14, 30, 60, 100];

/** Runs shorter than this are too new for a milestone or an at-risk nudge. */
export const MIN_MEANINGFUL_STREAK = 2;

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local calendar date, not UTC — a 11pm ritual must not land on tomorrow. */
export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000,
  );
}

/**
 * Walk backwards from `anchor`, stepping over at most one single missed night.
 * Returns the run length and which date (if any) the grace was spent on.
 *
 * The grace is available from the very first step, including on the anchor
 * itself — see rule 3. It still requires the run to continue on the far side of
 * the gap, so a lone missed night with nothing behind it ends the walk at zero
 * rather than inventing a run out of a single absence.
 */
function walkBack(
  doneSet: Set<string>,
  anchor: string,
): { length: number; protectedDate: string | null } {
  let cursor = anchor;
  let length = 0;
  let protectedDate: string | null = null;

  for (;;) {
    if (doneSet.has(cursor)) {
      length += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    // A gap. Forgivable once, and only when the run continues on the far side
    // of it — otherwise the run simply ended here.
    if (protectedDate === null && doneSet.has(addDays(cursor, -1))) {
      protectedDate = cursor;
      cursor = addDays(cursor, -1);
      continue;
    }
    return { length, protectedDate };
  }
}

/**
 * Longest run ever, using the same one-forgiven-night rule as the current run
 * (rule 4). Each run is walked from its most recent night, so a run is measured
 * once rather than once per night in it.
 */
function longestRun(doneDates: string[], doneSet: Set<string>): number {
  let longest = 0;
  for (const date of doneDates) {
    // Only start a walk from a run's most recent night, so each run is measured
    // once rather than once per night in it.
    const next = addDays(date, 1);
    if (doneSet.has(next)) continue;
    longest = Math.max(longest, walkBack(doneSet, date).length);
  }
  return longest;
}

/**
 * @param completedDates dates (YYYY-MM-DD) where BOTH partners submitted
 * @param today          local date key; injectable so callers can be tested
 */
export function computeStreakState(
  completedDates: string[],
  today: string = todayKey(),
): StreakState {
  const doneSet = new Set(completedDates);
  const todayComplete = doneSet.has(today);

  if (completedDates.length === 0) {
    return {
      current: 0,
      longest: 0,
      todayComplete: false,
      atRisk: false,
      protectedDate: null,
      graceAvailable: true,
    };
  }

  // Rule 2: an unfinished tonight doesn't end yesterday's run.
  const anchor = todayComplete ? today : addDays(today, -1);
  const { length: current, protectedDate } = walkBack(doneSet, anchor);
  const longest = Math.max(longestRun([...completedDates].sort(), doneSet), current);

  return {
    current,
    longest,
    todayComplete,
    atRisk: current > 0 && !todayComplete,
    protectedDate,
    graceAvailable: protectedDate === null,
  };
}

/** The dates a couple has fully completed, from any entry-shaped list. */
export function completedDates(
  entries: { date: string; submitted: boolean; partnerSubmitted: boolean }[],
): string[] {
  return entries.filter((e) => e.submitted && e.partnerSubmitted).map((e) => e.date);
}

export function nextMilestone(streak: number): number | null {
  return STREAK_MILESTONES.find((m) => m > streak) ?? null;
}
