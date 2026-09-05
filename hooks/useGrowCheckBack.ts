import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey, toDateKey } from '@/lib/streak';
import type { DailyEntry } from '@/context/AppContext';
import { selectPendingCheckBack, type PendingCheckBack } from '@/lib/growCheckBack';
import { scheduleGrowCheckBack } from '@/services/notifications';

/**
 * The Grow check-back: one soft question, the day after a couple saw guidance
 * on their Grow notes.
 *
 * Split across two sources on purpose:
 *  - *whether guidance was shown* for a date is per-device and unimportant, so
 *    it lives in AsyncStorage;
 *  - *whether it was answered* is the entry's `growFollowUp`, which is server
 *    state.
 *
 * The selection rule itself is `selectPendingCheckBack` in lib/growCheckBack.ts.
 */

const SEEN_KEY = 'lunara_grow_guidance_seen_v1';

function todayStr(): string {
  return todayKey();
}

export interface UseGrowCheckBackResult {
  pending: PendingCheckBack | null;
  /** Call when the guidance card is actually on screen for `date`. */
  markGuidanceSeen: (date: string) => void;
  ready: boolean;
}

export function useGrowCheckBack(entries: DailyEntry[]): UseGrowCheckBackResult {
  const [seenDates, setSeenDates] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SEEN_KEY);
        if (raw) setSeenDates(JSON.parse(raw));
      } catch {
        // First run or unreadable storage — nothing pending, the right default.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const markGuidanceSeen = useCallback((date: string) => {
    setSeenDates((prev) => {
      if (prev.includes(date)) return prev;
      // Only recent dates can ever be pending, so the list stays short.
      const next = [...prev, date].slice(-14);
      AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Scheduling sits outside the state updater so it isn't re-run if React
  // replays the update. `scheduleGrowCheckBack` is keyed by date, so a repeat
  // replaces rather than stacks.
  const seenKey = seenDates.join(',');
  useEffect(() => {
    if (!ready) return;
    const today = todayStr();
    const latest = seenDates.filter((d) => d >= today).sort().pop();
    if (latest) scheduleGrowCheckBack(latest).catch(() => {});
  }, [ready, seenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = useMemo(
    () => (ready ? selectPendingCheckBack(seenDates, entries, todayStr()) : null),
    [entries, ready, seenDates],
  );

  return { pending, markGuidanceSeen, ready };
}
