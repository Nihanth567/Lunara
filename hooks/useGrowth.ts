import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey, toDateKey } from '@/lib/streak';
import { getDailyGrowthTip, type GrowthTip } from '@/lib/growth';

/**
 * Local, device-side state for the growth nudges: which daily tips a couple
 * chose to try, how the next-day follow-up was answered, which nudges were
 * waved off, and the Connection Streak that grows each time they actually try
 * one. Kept in AsyncStorage rather than the server so it works in demo mode and
 * needs no migration.
 *
 * Nothing here decides *what* shows — that is `pickNudge` in lib/nudge.ts, and
 * `useNudge` wires the two together.
 */

const KEYS = {
  VIEWED_TIPS: 'lunara_growth_viewed_tips_v1',
  FOLLOW_UPS: 'lunara_growth_follow_ups_v1',
  CONNECTION_STREAK: 'lunara_growth_connection_streak_v1',
  DISMISSED_NUDGES: 'lunara_growth_dismissed_nudges_v1',
};

/** "later" is the "Not yet" button; "skip" clears it without an answer. */
export type FollowUpResponse = 'yes' | 'later' | 'skip';

interface ViewedTip {
  tipId: string;
  topic: string;
}

interface ConnectionStreakState {
  count: number;
  /** YYYY-MM-DD of the last day the streak was incremented. */
  lastIncrementDate: string | null;
  longest: number;
}

const EMPTY_STREAK: ConnectionStreakState = { count: 0, lastIncrementDate: null, longest: 0 };

function todayStr(): string {
  return todayKey();
}

function addDays(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

export interface UseGrowthResult {
  /** Today's growth tip (deterministic per date). */
  todayTip: GrowthTip;
  /**
   * True once the couple chose "I'll try it" on today's tip. (The storage key
   * says "viewed" — it predates the choice — but tomorrow's follow-up now only
   * asks about a tip someone actually picked.)
   */
  todayTipViewed: boolean;
  markTodayTipViewed: () => void;

  /**
   * Set when yesterday's tip was picked and the follow-up hasn't been answered
   * yet — the `tipFollowUp` nudge.
   */
  pendingFollowUp: { date: string; tip: GrowthTip } | null;
  respondToFollowUp: (response: FollowUpResponse) => void;

  connectionStreak: number;
  longestConnectionStreak: number;

  /**
   * Nudges waved off with "Not now", or offered once and left — keyed like
   * `tip:2026-09-24`. A dismissed nudge never comes back.
   */
  isNudgeDismissed: (key: string) => boolean;
  dismissNudge: (key: string) => void;

  ready: boolean;
}

export function useGrowth(): UseGrowthResult {
  const [viewedTips, setViewedTips] = useState<Record<string, ViewedTip>>({});
  const [followUps, setFollowUps] = useState<Record<string, FollowUpResponse>>({});
  const [streak, setStreak] = useState<ConnectionStreakState>(EMPTY_STREAK);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const today = todayStr();
  const todayTip = useMemo(() => getDailyGrowthTip(today), [today]);

  useEffect(() => {
    (async () => {
      try {
        const [v, f, s, d] = await Promise.all([
          AsyncStorage.getItem(KEYS.VIEWED_TIPS),
          AsyncStorage.getItem(KEYS.FOLLOW_UPS),
          AsyncStorage.getItem(KEYS.CONNECTION_STREAK),
          AsyncStorage.getItem(KEYS.DISMISSED_NUDGES),
        ]);
        if (v) setViewedTips(JSON.parse(v));
        if (f) setFollowUps(JSON.parse(f));
        if (s) setStreak({ ...EMPTY_STREAK, ...JSON.parse(s) });
        if (d) setDismissed(JSON.parse(d));
      } catch {
        // First run or unreadable storage — defaults are fine.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const markTodayTipViewed = useCallback(() => {
    setViewedTips((prev) => {
      if (prev[today]) return prev;
      const next = { ...prev, [today]: { tipId: todayTip.id, topic: todayTip.topic } };
      AsyncStorage.setItem(KEYS.VIEWED_TIPS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [today, todayTip]);

  const pendingFollowUp = useMemo(() => {
    const yesterday = addDays(today, -1);
    if (!viewedTips[yesterday]) return null;
    if (followUps[yesterday]) return null;
    return { date: yesterday, tip: getDailyGrowthTip(yesterday) };
  }, [today, viewedTips, followUps]);

  const respondToFollowUp = useCallback(
    (response: FollowUpResponse) => {
      const target = pendingFollowUp?.date ?? addDays(today, -1);
      setFollowUps((prev) => {
        const next = { ...prev, [target]: response };
        AsyncStorage.setItem(KEYS.FOLLOW_UPS, JSON.stringify(next)).catch(() => {});
        return next;
      });

      if (response !== 'yes') return;
      setStreak((prev) => {
        if (prev.lastIncrementDate === today) return prev; // once per day
        const continues = prev.lastIncrementDate ? daysBetween(prev.lastIncrementDate, today) <= 2 : false;
        const count = continues ? prev.count + 1 : 1;
        const next: ConnectionStreakState = {
          count,
          lastIncrementDate: today,
          longest: Math.max(prev.longest, count),
        };
        AsyncStorage.setItem(KEYS.CONNECTION_STREAK, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [pendingFollowUp, today],
  );

  const dismissNudge = useCallback((key: string) => {
    setDismissed((prev) => {
      if (prev.includes(key)) return prev;
      // Keys are dated and only recent ones can matter, so keep the list short.
      const next = [...prev, key].slice(-40);
      AsyncStorage.setItem(KEYS.DISMISSED_NUDGES, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isNudgeDismissed = useCallback((key: string) => dismissed.includes(key), [dismissed]);

  return {
    todayTip,
    todayTipViewed: Boolean(viewedTips[today]),
    markTodayTipViewed,
    pendingFollowUp,
    respondToFollowUp,
    connectionStreak: streak.count,
    longestConnectionStreak: streak.longest,
    isNudgeDismissed,
    dismissNudge,
    ready,
  };
}
