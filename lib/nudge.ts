/**
 * Tonight as a state machine, and the one growth nudge it may show.
 *
 * ─── The rule ────────────────────────────────────────────────────────────────
 *
 *   Tonight = do the night. At most ONE gentle growth nudge at a time, and
 *   never while someone is waiting on their partner.
 *
 * Tonight used to be a feed: a tip card, a tip follow-up, a Grow check-back and
 * a guidance card could all stack under the ritual at once, and the check-back
 * even showed while you were waiting. Every growth surface now goes through
 * `pickNudge` below and renders in `components/SingleNudgeSlot.tsx`. If you are
 * adding a growth card, add a `NudgeKind` here — do not render it on Tonight
 * directly, and do not put a second one on screen.
 *
 * ─── Phases ──────────────────────────────────────────────────────────────────
 *
 *   not_started      nothing answered yet            → prompt cards
 *   writing          at least one card answered      → prompt cards only
 *   waiting          you sent, they haven't (or they
 *                    haven't joined yet)              → fox + nudge partner
 *   ready_to_reveal  both sent, not opened yet        → the reveal CTA
 *   revealed         opened together                 → the night, then the slot
 *
 * "next_open" — the first visit of a new day — is `not_started` with a
 * follow-up pending: that is the one moment a follow-up may sit above the
 * cards, before the new night begins.
 *
 * ─── Slot priority ───────────────────────────────────────────────────────────
 *
 * Highest available wins; nothing else shows.
 *
 *   1. Follow-ups on yesterday (next day only, offered once, cleared on answer)
 *      a. `checkBack`   — yesterday's Grow guidance: did you try a small step?
 *                         Wins over (b): it is about the couple's own words.
 *      b. `tipFollowUp` — yesterday's tip, if they chose to try it
 *   2. `guidance` — how to grow, drawn from tonight's own Grow notes
 *   3. `tip`      — the generic daily tip from lib/growth.ts
 *
 * Follow-ups may show in `not_started` (next_open) or `revealed`. Guidance and
 * tips only once the night is `revealed`. Nothing, ever, in `writing`,
 * `waiting` or `ready_to_reveal`.
 */

export type TonightPhase = 'not_started' | 'writing' | 'waiting' | 'ready_to_reveal' | 'revealed';

export interface TonightState {
  /** Cards answered by text or voice. */
  answeredCount: number;
  submitted: boolean;
  partnerJoined: boolean;
  partnerSubmitted: boolean;
  revealed: boolean;
}

export function tonightPhase(s: TonightState): TonightPhase {
  if (s.submitted && s.revealed) return 'revealed';
  if (s.submitted && s.partnerJoined && s.partnerSubmitted) return 'ready_to_reveal';
  if (s.submitted) return 'waiting';
  return s.answeredCount > 0 ? 'writing' : 'not_started';
}

export type NudgeKind = 'checkBack' | 'tipFollowUp' | 'guidance' | 'tip';

/** Highest priority first. The order is the product decision — see above. */
export const NUDGE_PRIORITY: readonly NudgeKind[] = ['checkBack', 'tipFollowUp', 'guidance', 'tip'];

const FOLLOW_UPS: ReadonlySet<NudgeKind> = new Set(['checkBack', 'tipFollowUp']);

export function isFollowUp(kind: NudgeKind): boolean {
  return FOLLOW_UPS.has(kind);
}

/** Whether a nudge of this kind may be on screen in this phase at all. */
export function nudgeAllowed(phase: TonightPhase, kind: NudgeKind): boolean {
  if (phase === 'revealed') return true;
  if (phase === 'not_started') return isFollowUp(kind);
  return false;
}

/** The one nudge to show, or null. `available` says which kinds have something to offer. */
export function pickNudge(
  phase: TonightPhase,
  available: Partial<Record<NudgeKind, boolean>>,
): NudgeKind | null {
  return NUDGE_PRIORITY.find((kind) => available[kind] && nudgeAllowed(phase, kind)) ?? null;
}
