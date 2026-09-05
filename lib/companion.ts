/**
 * The couple's companion — a night fox, shared by both partners.
 *
 * This file is the whole contract. It owns *what the companion is feeling* and
 * nothing about how it is drawn, so the art can be replaced without touching a
 * single rule, and the rules can be unit-reasoned about without a renderer.
 * The fox itself lives in `components/NightFoxArt.tsx`, currently as a
 * geometric placeholder pending commissioned art in `assets/companion/fox/`.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * The ritual already produces everything a "living state" loop needs — two
 * submissions, a reveal, a shared streak, a last-completed night. What it
 * lacked was a single object that *changes visibly* because of them. A number
 * going up is a scoreboard; a creature that is brighter tonight than it was
 * yesterday is a reason to come back.
 *
 * ─── The one rule that is not negotiable ─────────────────────────────────────
 *
 * The register is soft loyalty, and nothing else. The fox is never dying, never
 * disappointed, never keeping score, and never unwell. A couple who missed four
 * nights opens the app to an animal *asleep* — a thing a healthy animal does —
 * not one wilting at them; every state in `CompanionState` is recoverable in a
 * single shared night, and the copy says so. Guilt is a retention mechanic that
 * works once and costs the relationship the app is supposed to be serving.
 *
 * ─── Derived, never stored ───────────────────────────────────────────────────
 *
 * There is no companion row, no companion table, no parallel counter to drift
 * out of step with the streak. Every state is computed from data the app
 * already holds, the same way `computeStreakState()` recomputes rather than
 * increments — so a missed night self-heals here too.
 */

/**
 * Six of these are reachable from the ritual on any given evening; the seventh
 * (`nesting`) belongs to a couple who hasn't finished a night together yet.
 *
 * Ordered here the way they're prioritised in `getCompanionState` — tonight's
 * live progress first, then what the history says.
 */
export type CompanionState =
  /** Paired (or still alone) with no completed night yet. Curled, unhurried. */
  | 'nesting'
  /** One of you has shared tonight and the other hasn't. Holding a light. */
  | 'waiting'
  /** Both shared, nothing opened yet. Wings up, about to go. */
  | 'ready'
  /** Tonight is done and open. The brightest the companion ever gets. */
  | 'glowing'
  /** Tonight is still open, but a live shared streak is carrying it. */
  | 'streaklit'
  /** A night or few missed. Dimmer, still awake, still here. */
  | 'resting'
  /** A longer quiet stretch. Asleep — and wakes on the very next shared night. */
  | 'sleeping';

export interface CompanionInput {
  /** Has this user submitted tonight? */
  mySubmitted: boolean;
  /** Has their partner submitted tonight? */
  partnerSubmitted: boolean;
  /**
   * Both submitted *and* this user has opened the reveal. Matches the app's
   * existing `DailyEntry.revealed`, which is per-device on purpose — opening
   * the reveal is a thing you do, not a thing that happens to you.
   */
  bothRevealed: boolean;
  /** The shared streak — both partners, always. Prefer `streakState.current`. */
  streak: number;
  /** Most recent night BOTH partners submitted (YYYY-MM-DD), or null if never. */
  lastCompletedAt: string | null;
  /** Tonight's date key. Pass `ritualDate`, not `todayKey()`, near midnight. */
  now: string;
  /**
   * Has a second person actually joined? A solo user who submits is `nesting`,
   * not `waiting` — there is nobody yet to hold a light for, and implying
   * otherwise is the one way this feature could turn cruel.
   */
  partnerJoined?: boolean;
}

/**
 * How many days of quiet before the companion falls asleep rather than resting.
 *
 * Three is deliberate and matches the streak's own softness: `computeStreakState`
 * forgives a single missed night, so anything inside a long weekend is still a
 * couple having a life, not a couple drifting. Sleeping is for the stretch where
 * a returning user needs to be met with "nothing was lost" rather than a state
 * that looks identical to the one they left.
 */
export const COMPANION_RESTING_WINDOW_DAYS = 3;

/** Streak lengths where the companion visibly gains a tier. */
export const COMPANION_TIERS = [7, 14, 30] as const;

/** 0 for a new or lapsed run, 3 once a month of shared nights has gathered. */
export type CompanionTier = 0 | 1 | 2 | 3;

export function companionTier(streak: number): CompanionTier {
  if (streak >= 30) return 3;
  if (streak >= 14) return 2;
  if (streak >= 7) return 1;
  return 0;
}

function daysBetweenKeys(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000,
  );
}

/**
 * The single source of truth for what the companion is doing right now.
 *
 * Pure, total, and ordered: tonight's live progress always outranks history, so
 * a couple on a 40-night run who has just submitted sees `waiting` (the state
 * with something to do) rather than `streaklit` (the state with something to
 * admire). Nothing here reads a clock, a store, or the network.
 */
export function getCompanionState({
  mySubmitted,
  partnerSubmitted,
  bothRevealed,
  streak,
  lastCompletedAt,
  now,
  partnerJoined = true,
}: CompanionInput): CompanionState {
  // ── Tonight, in the order the evening actually happens ──
  if (bothRevealed) return 'glowing';
  if (mySubmitted && partnerSubmitted) return 'ready';
  // Symmetric on purpose: it is the same creature whichever half of the couple
  // is still to come. Only the label below names a side.
  if (partnerJoined && mySubmitted !== partnerSubmitted) return 'waiting';

  // ── Nothing has happened tonight yet, so history decides ──
  if (lastCompletedAt === null) return 'nesting';
  if (streak > 0) return 'streaklit';

  const quietDays = daysBetweenKeys(lastCompletedAt, now);
  return quietDays <= COMPANION_RESTING_WINDOW_DAYS ? 'resting' : 'sleeping';
}

export interface CompanionCopyContext {
  streak?: number;
  /**
   * Which half of the couple the night is still waiting on. `waiting` is the
   * only state that cares, and getting it backwards would tell someone their
   * partner is holding a light they are actually holding themselves.
   */
  waitingOn?: 'partner' | 'you';
}

/**
 * One short, warm line. Always optional — the state is legible without it, and
 * every surface that shows the companion decides for itself whether a label
 * earns its space.
 *
 * Nothing here instructs, measures, or asks. "Still here" is the entire message
 * of a missed night.
 */
export function companionLabel(
  state: CompanionState,
  { streak = 0, waitingOn = 'partner' }: CompanionCopyContext = {},
): string {
  switch (state) {
    case 'nesting':
      return 'Settling in';
    case 'waiting':
      return waitingOn === 'you' ? 'Waiting up with you' : 'Holding a light for them';
    case 'ready':
      return 'You’re both here';
    case 'glowing':
      return 'Tonight is shared';
    case 'streaklit':
      return streak === 1 ? 'Still lit from last night' : `Still lit from ${streak} nights`;
    case 'resting':
      return 'Still here';
    case 'sleeping':
      return 'Sleeping softly';
  }
}

/**
 * A slightly longer line for the surfaces with room for one — the waiting card,
 * the post-reveal moment. Same rules: no lecture, no ask, no score.
 */
export function companionSubtitle(
  state: CompanionState,
  { streak = 0 }: CompanionCopyContext = {},
): string {
  switch (state) {
    case 'nesting':
      return 'It brightens the first night you finish together.';
    case 'waiting':
      return 'It stays lit until you’ve both shared.';
    case 'ready':
      return 'Open tonight whenever you’re ready.';
    case 'glowing':
      return streak > 1
        ? `Brighter for every one of these ${streak} nights.`
        : 'Warm and wide awake tonight.';
    case 'streaklit':
      return 'Tonight keeps it glowing — no rush.';
    case 'resting':
      return 'One shared night brings it right back.';
    case 'sleeping':
      return 'It wakes on the next night you share.';
  }
}

/** For accessibility labels and the widget — plain, no metaphor. */
export function companionAccessibilityLabel(
  state: CompanionState,
  ctx: CompanionCopyContext = {},
): string {
  return `Your companion: ${companionLabel(state, ctx).toLowerCase()}`;
}

/**
 * The most recent night both partners submitted, or null.
 *
 * Takes the same entry shape as `completedDates()` in `lib/streak.ts` so the
 * companion and the streak can never disagree about which nights counted.
 */
export function lastCompletedDate(
  entries: { date: string; submitted: boolean; partnerSubmitted: boolean }[],
): string | null {
  let latest: string | null = null;
  for (const entry of entries) {
    if (!entry.submitted || !entry.partnerSubmitted) continue;
    if (latest === null || entry.date > latest) latest = entry.date;
  }
  return latest;
}
