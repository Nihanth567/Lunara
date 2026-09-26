import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  ChoiceCard,
  FUNNEL,
  OnboardingFrame,
  OnboardingHeading,
} from '@/components/OnboardingFrame';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { LunaraButton } from '@/components/LunaraButton';
import { SpringPressable } from '@/components/SpringPressable';
import { useOnboardingFunnel } from '@/hooks/useOnboardingFunnel';
import { NIGHT_FEELS } from '@/lib/onboardingQuiz';
import { palette } from '@/constants/colors';
import { duration, pressScale, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

/**
 * Meet your fox — the attachment beat, before anything is asked of anyone.
 *
 * The fox arrives settled and unlit, and lights up the first time it is
 * touched: the same change of state, and the same small lift of the head, that
 * it makes on the night both of you show up. So the first thing a person does
 * with it is the thing it exists for.
 *
 * It is not named here. A name would have to live somewhere both partners can
 * see it, which is a server field and a feature; a name that quietly vanished
 * after onboarding would be worse than none.
 *
 * The one choice — how nights should feel — is the first answer of the quiz
 * that follows. It changes a chip on the plan card, and nothing else.
 */
export default function FoxScreen() {
  const router = useRouter();
  const { nightFeel, setNightFeel } = useOnboardingFunnel();
  const [lit, setLit] = useState(false);

  return (
    <OnboardingFrame
      step={FUNNEL.fox}
      footer={
        <LunaraButton
          title="Continue"
          disabled={!nightFeel}
          onPress={() => router.push('/(onboarding)/quiz' as never)}
        />
      }
    >
      <View style={styles.hero}>
        <SpringPressable
          onPress={() => setLit(true)}
          scaleTo={pressScale.card}
          accessibilityLabel={lit ? 'Your fox, glowing' : 'Your fox. Tap to say hello.'}
          accessibilityRole="imagebutton"
        >
          <CoupleCompanion state={lit ? 'glowing' : 'nesting'} size="hero" />
        </SpringPressable>
        <Text style={styles.hint} maxFontSizeMultiplier={maxFontScale}>
          {lit ? 'There it is. That’s what showing up looks like.' : 'Tap to say hello'}
        </Text>
      </View>

      <OnboardingHeading
        title="Meet your night fox"
        body="It belongs to both of you, and it glows when both of you show up."
      />

      <Animated.View entering={FadeIn.duration(duration.base)} style={styles.question}>
        <Text style={styles.questionTitle} maxFontSizeMultiplier={maxFontScale}>
          How should your nights feel?
        </Text>
        <View style={styles.choices} accessibilityRole="radiogroup">
          {NIGHT_FEELS.map((feel) => (
            <ChoiceCard
              key={feel.id}
              label={feel.label}
              detail={feel.detail}
              icon={feel.icon}
              selected={nightFeel === feel.id}
              onPress={() => setNightFeel(feel.id)}
            />
          ))}
        </View>
      </Animated.View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm },
  hint: { ...text.callout, color: palette.content[2], textAlign: 'center' },
  question: { gap: space.md },
  questionTitle: { ...text.heading, color: palette.content[0] },
  choices: { gap: space.sm },
});
