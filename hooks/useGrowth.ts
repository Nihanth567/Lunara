import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey, toDateKey } from '@/lib/streak';
import {
  buildWeeklyRecap,
  getDailyGrowthTip,
  type GrowthTip,
  type WeeklyRecap,
} from '@/lib/growth';

/**
 * Local, device-side state for the growth module: which daily tips have been
 * seen, how the next-day follow-up was answered, and the Connection Streak that
 * grows each time a couple actually tries a tip. Kept in AsyncStorage rather
 * than the server so it works in demo mode and needs no migration.
 */

const KEYS = {
  VIEWED_TIPS: 'lunara_growth_viewed_tips_v1',
  FOLLOW_UPS: 'lunara_growth_follow_ups_v1',
  CONNECTION_STREAK: 'lunara_growth_connection_streak_v1',
};

export type FollowUpResponse = 'yes' | 'later';

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
  /** True once the Tonight screen has surfaced today's tip. */
  todayTipViewed: boolean;
  markTodayTipViewed: () => void;

  /**
   * Set when yesterday's tip was viewed and the follow-up hasn't been answered
   * yet — drives the next-day follow-up card on Tonight.
   */
  pendingFollowUp: { date: string; tip: GrowthTip } | null;
  respondToFollowUp: (response: FollowUpResponse) => void;

  connectionStreak: number;
  longestConnectionStreak: number;

  /** Weekly recap for the Us tab; `completedPromptDates` comes from app entries. */
  getWeeklyRecap: (completedPromptDates: string[]) => WeeklyRecap;

  ready: boolean;
}

export function useGrowth(): UseGrowthResult {
  const [viewedTips, setViewedTips] = useState<Record<string, ViewedTip>>({});
  const [followUps, setFollowUps] = useState<Record<string, FollowUpResponse>>({});
  const [streak, setStreak] = useState<ConnectionStreakState>(EMPTY_STREAK);
  const [ready, setReady] = useState(false);

  const today = todayStr();
  const todayTip = useMemo(() => getDailyGrowthTip(today), [today]);

  useEffect(() => {
    (async () => {
      try {
        const [v, f, s] = await Promise.all([
          AsyncStorage.getItem(KEYS.VIEWED_TIPS),
          AsyncStorage.getItem(KEYS.FOLLOW_UPS),
          AsyncStorage.getItem(KEYS.CONNECTION_STREAK),
        ]);
        if (v) setViewedTips(JSON.parse(v));
        if (f) setFollowUps(JSON.parse(f));
        if (s) setStreak({ ...EMPTY_STREAK, ...JSON.parse(s) });
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

  const getWeeklyRecap = useCallback(
    (completedPromptDates: string[]) =>
      buildWeeklyRecap({
        today,
        viewedTipDates: Object.keys(viewedTips),
        triedTipDates: Object.entries(followUps)
          .filter(([, r]) => r === 'yes')
          .map(([d]) => d),
        completedPromptDates,
      }),
    [today, viewedTips, followUps],
  );

  return {
    todayTip,
    todayTipViewed: Boolean(viewedTips[today]),
    markTodayTipViewed,
    pendingFollowUp,
    respondToFollowUp,
    connectionStreak: streak.count,
    longestConnectionStreak: streak.longest,
    getWeeklyRecap,
    ready,
  };
}
