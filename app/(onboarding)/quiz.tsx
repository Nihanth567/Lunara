import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  ChoiceCard,
  FUNNEL,
  OnboardingFrame,
  OnboardingHeading,
} from '@/components/OnboardingFrame';
import { SpringPressable } from '@/components/SpringPressable';
import { useOnboardingFunnel } from '@/hooks/useOnboardingFunnel';
import { QUESTIONS } from '@/lib/onboardingQuiz';
import { palette } from '@/constants/colors';
import { duration, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

/**
 * Long enough for the tick and the highlight to land before the next question
 * replaces them — so a tap reads as "chosen", not as "skipped past".
 */
const ADVANCE_MS = 320;

/**
 * The investment quiz — six questions, one per screen, one tap each.
 *
 * One route rather than six: the questions share everything but their words,
 * and stepping through them in place keeps back-navigation inside the quiz
 * rather than unwinding the stack a question at a time. The progress bar still
 * moves per question.
 *
 * A tap advances on its own after a beat. Going back shows the earlier answer
 * still chosen, and tapping it again moves forward.
 */
export default function QuizScreen() {
  const router = useRouter();
  const { answers, setAnswer } = useOnboardingFunnel();
  const [index, setIndex] = useState(0);
  const advancing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (advancing.current) clearTimeout(advancing.current);
    },
    [],
  );

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  const next = () => {
    advancing.current = null;
    if (isLast) router.push('/(onboarding)/belief' as never);
    else setIndex((i) => i + 1);
  };

  const choose = (value: string | undefined) => {
    // A second tap while the first is still landing is ignored, not queued.
    if (advancing.current) return;
    setAnswer(question.key, value);
    advancing.current = setTimeout(next, ADVANCE_MS);
  };

  const back = () => {
    if (advancing.current) {
      clearTimeout(advancing.current);
      advancing.current = null;
    }
    if (index === 0) router.back();
    else setIndex((i) => i - 1);
  };

  return (
    <OnboardingFrame step={FUNNEL.quiz + index} onBack={back}>
      <Animated.View
        key={question.key}
        entering={FadeIn.duration(duration.base)}
        style={styles.body}
      >
        <Text style={styles.counter} maxFontSizeMultiplier={maxFontScale}>
          {index + 1} of {QUESTIONS.length}
        </Text>
        <OnboardingHeading title={question.title} />
        <View style={styles.choices} accessibilityRole="radiogroup">
          {question.options.map((option) => (
            <ChoiceCard
              key={option.id}
              label={option.label}
              icon={option.icon}
              selected={answers[question.key] === option.id}
              onPress={() => choose(option.id)}
            />
          ))}
        </View>
        {question.optional && (
          <SpringPressable
            onPress={() => choose(undefined)}
            feedback="highlight"
            hitSlop={10}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip this one</Text>
          </SpringPressable>
        )}
      </Animated.View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  counter: { ...text.caption, color: palette.content[2] },
  choices: { gap: space.sm },
  skip: { alignSelf: 'center', paddingVertical: space.sm },
  skipText: { ...text.callout, color: palette.content[2] },
});
