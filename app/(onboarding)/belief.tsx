import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  FUNNEL,
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPhoto,
} from '@/components/OnboardingFrame';
import { ONBOARDING_PHOTOS } from '@/assets/images/onboarding';
import { LunaraButton } from '@/components/LunaraButton';
import { useOnboardingFunnel } from '@/hooks/useOnboardingFunnel';
import { beliefLine } from '@/lib/onboardingQuiz';
import { palette, tint } from '@/constants/colors';
import { radius, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

/**
 * Encouragement, then the one rule that makes this a couples app.
 *
 * The line under the title answers whatever they said was hardest, without
 * promising to fix it. The card below says plainly that Lunara is incomplete
 * alone — and, in the same breath, that the partner joins free, because "it
 * takes both of you" on the way to a paywall otherwise reads as "so you'll
 * both be paying".
 */
export default function BeliefScreen() {
  const router = useRouter();
  const { answers } = useOnboardingFunnel();

  return (
    <OnboardingFrame
      step={FUNNEL.belief}
      footer={
        <LunaraButton
          title="Continue"
          onPress={() => router.push('/(onboarding)/notifications' as never)}
        />
      }
    >
      {/* What "closer" looks like, before the sentence that says it. The fox
          has had two screens; this one is about the two of them. */}
      <OnboardingPhoto photo={ONBOARDING_PHOTOS.close} aspectRatio={4 / 3} />

      <OnboardingHeading
        title="You’re already doing more than most couples."
        body={beliefLine(answers)}
      />

      <View style={styles.both}>
        <View style={styles.people} importantForAccessibility="no-hide-descendants">
          <View style={[styles.person, { borderColor: tint.heart(0.4) }]}>
            <Text style={[styles.personText, { color: palette.partners.a }]}>You</Text>
          </View>
          <Ionicons name="heart" size={16} color={palette.accent.heart} />
          <View style={[styles.person, { borderColor: tint.moon(0.4) }]}>
            <Text style={[styles.personText, { color: palette.partners.b }]}>Them</Text>
          </View>
        </View>
        <Text style={styles.bothTitle} maxFontSizeMultiplier={maxFontScale}>
          It takes both of you
        </Text>
        <Text style={styles.bothBody} maxFontSizeMultiplier={maxFontScale}>
          A night only opens once you’ve both answered. Your partner joins with your
          invite code, and never pays.
        </Text>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  both: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space.xl,
    gap: space.sm,
  },
  people: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  person: {
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  personText: { ...text.label, fontSize: 14 },
  bothTitle: { ...text.heading, color: palette.content[0] },
  bothBody: { ...text.callout, color: palette.content[1], lineHeight: 21 },
});
