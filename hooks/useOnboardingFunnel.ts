import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NightFeel, QuizAnswers, QuizKey } from '@/lib/onboardingQuiz';

const KEY = 'lunara_onboarding_funnel_v1';

/**
 * What the first-run funnel remembers on this device.
 *
 * Local only, on purpose: the answers exist to make the end of onboarding sound
 * like it was listening (see `lib/onboardingQuiz.ts`), and nothing in the
 * product reads them, so they have no business on a server. Kept across
 * launches so someone who leaves mid-quiz finds their answers still chosen.
 */
export interface OnboardingFunnel {
  answers: QuizAnswers;
  nightFeel?: NightFeel;
  /**
   * The notifications step has asked. Pairing's last step asks too — for the
   * invited partner, who never passes through this funnel — and without this a
   * purchaser who said "Not now" would be asked a second time a minute later.
   */
  notificationsAsked?: boolean;
}

const EMPTY: OnboardingFunnel = { answers: {} };

function parse(raw: string | null): OnboardingFunnel {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<OnboardingFunnel>;
    return { ...value, answers: value.answers ?? {} };
  } catch {
    return EMPTY;
  }
}

/** One-off read, for code outside a screen (pairing's last step). */
export async function readOnboardingFunnel(): Promise<OnboardingFunnel> {
  return parse(await AsyncStorage.getItem(KEY).catch(() => null));
}

export function useOnboardingFunnel() {
  const [funnel, setFunnel] = useState<OnboardingFunnel>(EMPTY);
  const [ready, setReady] = useState(false);
  // The latest value, so two quick writes in a row build on each other rather
  // than the second overwriting the first with a stale copy.
  const latest = useRef<OnboardingFunnel>(EMPTY);

  useEffect(() => {
    let alive = true;
    readOnboardingFunnel().then((stored) => {
      if (!alive) return;
      latest.current = stored;
      setFunnel(stored);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback((next: OnboardingFunnel) => {
    latest.current = next;
    setFunnel(next);
    // Non-critical and per-device: a failed write costs a pre-chosen answer on
    // the next launch, nothing more.
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setAnswer = useCallback(
    (key: QuizKey, value: string | undefined) =>
      save({ ...latest.current, answers: { ...latest.current.answers, [key]: value } }),
    [save],
  );

  const setNightFeel = useCallback(
    (nightFeel: NightFeel) => save({ ...latest.current, nightFeel }),
    [save],
  );

  const markNotificationsAsked = useCallback(
    () => save({ ...latest.current, notificationsAsked: true }),
    [save],
  );

  return { ...funnel, ready, setAnswer, setNightFeel, markNotificationsAsked };
}
