import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FUNNEL, OnboardingFrame, OnboardingHeading } from '@/components/OnboardingFrame';
import { LunaraButton } from '@/components/LunaraButton';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import { useApp } from '@/context/AppContext';
import { useOnboardingFunnel } from '@/hooks/useOnboardingFunnel';
import { nightPlanSteps, planChips, planFraming, rhythmLine } from '@/lib/onboardingQuiz';
import { dailyPrompt } from '@/lib/dailyPrompts';
import { hasStoreKey } from '@/lib/purchases';
import { haptic } from '@/lib/haptics';
import { palette, tint } from '@/constants/colors';
import { duration, radius, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

/** Per checklist line. Four lines is under three seconds — long enough to read. */
const STEP_MS = 650;

type AccountState = 'working' | 'ready' | 'failed';

/**
 * "Building your first night…" — the plan moment before the paywall.
 *
 * ─── Theatre, but honest theatre ─────────────────────────────────────────────
 *
 * The checklist is paced for reading, and every line on it is true of the
 * product (see `nightPlanSteps`). The plan card that follows shows tonight's
 * real first question — the one the Grateful card will ask — so the
 * personalisation is not only in the wording.
 *
 * ─── The real work under it ──────────────────────────────────────────────────
 *
 * This is where the anonymous account is made (`startAnonymousAccount`). The
 * paywall is next, and a purchase needs an account to belong to: RevenueCat is
 * configured with its user id, and the webhook unlocks the couple from its
 * profile. Doing it here means the wait people already expect on this screen
 * covers the network round trip, and the paywall opens with its plans loaded.
 * If it fails, the screen says so and offers to try again rather than letting
 * someone reach a paywall that cannot sell.
 */
export default function BuildingScreen() {
  const router = useRouter();
  const { startAnonymousAccount, purchasesReady, notificationSettings, ritualDate } = useApp();
  const { answers, nightFeel } = useOnboardingFunnel();
  const [shown, setShown] = useState(0);
  const [account, setAccount] = useState<AccountState>('working');
  const announced = useRef(false);

  const steps = nightPlanSteps(answers, { remindersOn: notificationSettings.enabled });

  const createAccount = () => {
    setAccount('working');
    startAnonymousAccount()
      .then(() => setAccount('ready'))
      .catch(() => {
        haptic.error();
        setAccount('failed');
      });
  };

  useEffect(createAccount, []);

  useEffect(() => {
    if (shown >= steps.length) return;
    const timer = setTimeout(() => setShown((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [shown, steps.length]);

  // Without a store key there is nothing to wait for — see the dev hole in
  // `resolveGate`, which this mirrors.
  const storeReady = purchasesReady || !hasStoreKey();
  const planReady = shown >= steps.length && account === 'ready' && storeReady;

  useEffect(() => {
    if (!planReady || announced.current) return;
    announced.current = true;
    haptic.success();
    AccessibilityInfo.announceForAccessibility('Your first night is ready.');
  }, [planReady]);

  const handleContinue = () => {
    if (!hasStoreKey() && __DEV__) {
      // No RevenueCat on this build: nothing to sell, so straight to sign-in.
      router.replace('/(onboarding)/auth?after=trial' as never);
      return;
    }
    router.push('/(modals)/paywall?gate=1&source=onboarding' as never);
  };

  const chips = planChips(answers, nightFeel);

  return (
    <OnboardingFrame
      step={FUNNEL.building}
      canGoBack={account !== 'working'}
      footer={
        account === 'failed' ? (
          <LunaraButton title="Try again" variant="secondary" onPress={createAccount} />
        ) : (
          <LunaraButton title="Continue" onPress={handleContinue} disabled={!planReady} />
        )
      }
    >
      <OnboardingHeading
        title={planReady ? 'Your first night is ready' : 'Building your first night…'}
      />

      <View style={styles.steps} accessibilityLiveRegion="polite">
        {steps.map((line, i) => {
          const done = i < shown;
          const active = i === shown;
          return (
            <View key={line} style={styles.step}>
              <View style={styles.stepMark}>
                {done ? (
                  <Animated.View entering={FadeIn.duration(duration.fast)}>
                    <Ionicons name="checkmark-circle" size={20} color={palette.accent.success} />
                  </Animated.View>
                ) : active ? (
                  <ThinkingOrb state="working" size={20} theme="dark" accessibilityLabel={line} />
                ) : (
                  <View style={styles.pendingDot} />
                )}
              </View>
              <Text
                style={[styles.stepText, !done && !active && styles.stepPending]}
                maxFontSizeMultiplier={maxFontScale}
              >
                {line}
              </Text>
            </View>
          );
        })}
      </View>

      {account === 'failed' && (
        <Text style={styles.failed} maxFontSizeMultiplier={maxFontScale}>
          We couldn’t reach Lunara just now. Check your connection and try again — your
          answers are saved.
        </Text>
      )}

      {planReady && (
        <Animated.View entering={FadeIn.duration(duration.base)} style={styles.plan}>
          {chips.length > 0 && (
            <View style={styles.chips}>
              {chips.map((chip) => (
                <View key={chip} style={styles.chip}>
                  <Text style={styles.chipText} maxFontSizeMultiplier={maxFontScale}>
                    {chip}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.framing} maxFontSizeMultiplier={maxFontScale}>
            {planFraming(answers)}
          </Text>
          <View style={styles.firstQuestion}>
            <Text style={styles.firstLabel} maxFontSizeMultiplier={maxFontScale}>
              Tonight’s first question
            </Text>
            <Text style={styles.firstText} maxFontSizeMultiplier={maxFontScale}>
              {dailyPrompt('grateful', ritualDate)}
            </Text>
          </View>
          <Text style={styles.rhythm} maxFontSizeMultiplier={maxFontScale}>
            {rhythmLine(answers)}
          </Text>
        </Animated.View>
      )}
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  steps: { gap: space.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepMark: { width: 22, alignItems: 'center' },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: palette.ink[4],
  },
  stepText: { ...text.callout, color: palette.content[0], flex: 1 },
  stepPending: { color: palette.content[2] },
  failed: { ...text.callout, color: palette.accent.danger },

  plan: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.glow(0.22),
    padding: space.xl,
    gap: space.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    // Violet, not apricot: a chip is a label, and apricot means "act on this".
    backgroundColor: tint.moon(0.12),
  },
  chipText: { ...text.caption, color: palette.accent.moon },
  framing: { ...text.heading, color: palette.content[0] },
  firstQuestion: {
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: tint.heart(0.07),
  },
  firstLabel: { ...text.caption, color: palette.accent.heart },
  firstText: { ...text.prose, color: palette.content[0] },
  rhythm: { ...text.callout, color: palette.content[1], lineHeight: 21 },
});
