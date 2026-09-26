import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useGrowth, type FollowUpResponse } from '@/hooks/useGrowth';
import { useGrowCheckBack } from '@/hooks/useGrowCheckBack';
import { isFollowUp, nudgeAllowed, pickNudge, type NudgeKind, type TonightPhase } from '@/lib/nudge';
import type { GrowthTip } from '@/lib/growth';
import type { GrowFollowUpResponse } from '@/lib/growCheckBack';
import { cancelGrowCheckBack } from '@/services/notifications';

/**
 * The single nudge slot's brain: gathers what each growth source has to offer,
 * lets `pickNudge` (lib/nudge.ts) choose one, and owns what happens when the
 * couple answers. `components/SingleNudgeSlot.tsx` only draws the result.
 *
 * Two small pieces of state keep "one at a time" true on screen, not just in
 * the rule:
 *  - `frozen` — once someone taps an answer, that card stays put for its short
 *    thank-you even though its source has already cleared. Without it the next
 *    nudge in line would swap in underneath their thumb.
 *  - `doneInPhase` — after a nudge finishes, the slot stays empty for the rest
 *    of that phase. Answering one never immediately serves another.
 */

type NudgeBase = { key: string; date: string };
export type Nudge =
  | (NudgeBase & { kind: 'checkBack'; growText: string })
  | (NudgeBase & { kind: 'tipFollowUp'; tip: GrowthTip })
  | (NudgeBase & { kind: 'guidance'; growTexts: string[] })
  | (NudgeBase & { kind: 'tip'; tip: GrowthTip });

export interface UseNudgeResult {
  nudge: Nudge | null;
  /** False until the per-device growth state has loaded — don't lay out around it yet. */
  ready: boolean;
  respondCheckBack: (nudge: Nudge, response: GrowFollowUpResponse) => void;
  respondTipFollowUp: (nudge: Nudge, response: FollowUpResponse) => void;
  guidanceShown: (nudge: Nudge) => void;
  dismissGuidance: (nudge: Nudge) => void;
  tryTip: (nudge: Nudge) => void;
  notNowTip: (nudge: Nudge) => void;
  /** A card calls this when it has finished (after its thank-you). */
  finish: () => void;
}

const keyFor = (kind: NudgeKind, date: string) => `${kind}:${date}`;

export function useNudge(phase: TonightPhase): UseNudgeResult {
  const { entries, todayEntry, ritualDate, setGrowFollowUp } = useApp();
  const growth = useGrowth();
  const checkBack = useGrowCheckBack(entries);

  // ─── What each source has to offer ─────────────────────────────────────────
  const candidates: Partial<Record<NudgeKind, Nudge>> = {};

  if (checkBack.pending) {
    const key = keyFor('checkBack', checkBack.pending.date);
    if (!growth.isNudgeDismissed(key)) {
      candidates.checkBack = { kind: 'checkBack', key, date: checkBack.pending.date, growText: checkBack.pending.growText };
    }
  }

  if (growth.pendingFollowUp) {
    const key = keyFor('tipFollowUp', growth.pendingFollowUp.date);
    if (!growth.isNudgeDismissed(key)) {
      candidates.tipFollowUp = { kind: 'tipFollowUp', key, date: growth.pendingFollowUp.date, tip: growth.pendingFollowUp.tip };
    }
  }

  if (todayEntry) {
    const growTexts = [todayEntry.grow, todayEntry.partnerGrow].filter((t) => t.trim().length > 0);
    const key = keyFor('guidance', todayEntry.date);
    if (growTexts.length > 0 && !growth.isNudgeDismissed(key)) {
      candidates.guidance = { kind: 'guidance', key, date: todayEntry.date, growTexts };
    }
  }

  {
    const key = keyFor('tip', ritualDate);
    if (!growth.todayTipViewed && !growth.isNudgeDismissed(key)) {
      candidates.tip = { kind: 'tip', key, date: ritualDate, tip: growth.todayTip };
    }
  }

  const ready = growth.ready && checkBack.ready;
  const available = Object.fromEntries(
    Object.keys(candidates).map((k) => [k, true]),
  ) as Partial<Record<NudgeKind, boolean>>;
  const pickedKind = ready ? pickNudge(phase, available) : null;
  const picked = pickedKind ? candidates[pickedKind] ?? null : null;

  // ─── What is actually on screen ────────────────────────────────────────────
  const [frozen, setFrozen] = useState<Nudge | null>(null);
  const [doneInPhase, setDoneInPhase] = useState<TonightPhase | null>(null);

  const current: Nudge | null =
    doneInPhase === phase
      ? null
      : frozen && nudgeAllowed(phase, frozen.kind)
        ? frozen
        : picked;

  // A follow-up is offered once. If the day's first visit showed one and the
  // couple started writing without answering, that was their answer — it
  // doesn't come back after the reveal.
  const shownRef = useRef<Nudge | null>(null);
  const prevPhaseRef = useRef(phase);
  const { dismissNudge } = growth;
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === phase) return;
    const left = shownRef.current;
    if (prev === 'not_started' && left && isFollowUp(left.kind)) dismissNudge(left.key);
    setFrozen(null);
  }, [phase, dismissNudge]);

  // Declared after the phase effect on purpose: effects run in order, so the
  // check above still sees what was on screen *before* the phase changed. Only
  // that check reads this ref.
  useEffect(() => {
    shownRef.current = current;
  });

  // Actions take the nudge they are answering rather than reading "what's on
  // screen" from a ref: a card reports itself from its own effects, which run
  // before this hook's, so a ref would still hold the previous render.
  const hold = useCallback((n: Nudge) => setFrozen((f) => f ?? n), []);

  const finish = useCallback(() => {
    setFrozen(null);
    setDoneInPhase(phase);
  }, [phase]);

  // ─── Answers ───────────────────────────────────────────────────────────────
  const respondCheckBack = useCallback((n: Nudge, response: GrowFollowUpResponse) => {
    hold(n);
    // Server state: answering on one phone clears it on the other.
    setGrowFollowUp(n.date, response).catch(() => {});
    cancelGrowCheckBack(n.date).catch(() => {});
  }, [hold, setGrowFollowUp]);

  const { respondToFollowUp, markTodayTipViewed } = growth;
  const respondTipFollowUp = useCallback((n: Nudge, response: FollowUpResponse) => {
    hold(n);
    respondToFollowUp(response);
  }, [hold, respondToFollowUp]);

  // "Seen" is what schedules tomorrow's check-back, so it is recorded only when
  // the guidance card is really on screen.
  const { markGuidanceSeen } = checkBack;
  const guidanceShown = useCallback((n: Nudge) => markGuidanceSeen(n.date), [markGuidanceSeen]);

  const dismissGuidance = useCallback((n: Nudge) => {
    dismissNudge(n.key);
    finish();
  }, [dismissNudge, finish]);

  const tryTip = useCallback((n: Nudge) => {
    hold(n);
    markTodayTipViewed();
  }, [hold, markTodayTipViewed]);

  const notNowTip = useCallback((n: Nudge) => dismissNudge(n.key), [dismissNudge]);

  return {
    nudge: current,
    ready,
    respondCheckBack,
    respondTipFollowUp,
    guidanceShown,
    dismissGuidance,
    tryTip,
    notNowTip,
    finish,
  };
}
