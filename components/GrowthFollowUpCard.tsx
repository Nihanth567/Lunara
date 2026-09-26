import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { GrowthTip } from '@/lib/growth';
import { haptic } from '@/lib/haptics';
import { SpringPressable } from '@/components/SpringPressable';
import type { FollowUpResponse } from '@/hooks/useGrowth';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { palette, tint } from '@/constants/colors';
import { duration, radius, space, touchTarget } from '@/constants/tokens';
import { type as text } from '@/constants/typography';

interface Props {
  tip: GrowthTip;
  onRespond: (response: FollowUpResponse) => void;
  /** Called once the card has finished (after the short reply, or straight away on Skip). */
  onDone: () => void;
}

const OPTIONS: { value: FollowUpResponse; label: string }[] = [
  { value: 'yes', label: 'Yes, we did' },
  { value: 'later', label: 'Not yet' },
  { value: 'skip', label: 'Skip' },
];

/**
 * "Did you try yesterday's idea?" — a next-day follow-up in the single nudge
 * slot (lib/nudge.ts). Only asked about a tip someone chose to try, only the
 * next day, and every answer clears it.
 *
 * It used to report a separate "Connection Streak" on yes. Lunara already has
 * one streak; a second number under it was one more thing to keep track of, so
 * a yes now just gets a little confetti and a warm line.
 */
export function GrowthFollowUpCard({ tip, onRespond, onDone }: Props) {
  const [answer, setAnswer] = useState<FollowUpResponse | null>(null);
  const [confetti, setConfetti] = useState(0);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (doneRef.current) clearTimeout(doneRef.current);
  }, []);

  const handle = (response: FollowUpResponse) => {
    if (answer) return;
    setAnswer(response);
    onRespond(response);
    if (response === 'skip') {
      haptic.selection();
      onDone();
      return;
    }
    if (response === 'yes') {
      haptic.success();
      setConfetti((c) => c + 1);
    } else {
      haptic.selection();
    }
    doneRef.current = setTimeout(onDone, 2400);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(duration.base)}
      exiting={FadeOut.duration(duration.exit)}
      style={styles.card}
    >
      <ConfettiBurst trigger={confetti} />

      {answer === null || answer === 'skip' ? (
        <>
          <View style={styles.header}>
            <Ionicons name="bulb-outline" size={16} color={palette.accent.success} />
            <Text style={styles.eyebrow}>Yesterday’s idea</Text>
          </View>
          <Text style={styles.question}>Did you get to try it?</Text>
          <Text style={styles.quote} numberOfLines={2}>“{tip.tip}”</Text>
          <View style={styles.pills}>
            {OPTIONS.map((option) => (
              <SpringPressable
                key={option.value}
                style={[styles.pill, option.value === 'yes' && styles.pillYes]}
                onPress={() => handle(option.value)}
                // Each answer says its own haptic in `handle`.
                haptic="none"
              >
                <Text style={[styles.pillText, option.value === 'yes' && styles.pillTextYes]}>
                  {option.label}
                </Text>
              </SpringPressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.resultRow}>
          <Ionicons
            name={answer === 'yes' ? 'sparkles' : 'moon-outline'}
            size={16}
            color={answer === 'yes' ? palette.accent.success : palette.content[1]}
          />
          <Text style={styles.resultText}>
            {answer === 'yes' ? 'That’s lovely. Little things add up.' : 'No rush — there’s always tonight.'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.success(0.18),
    padding: space.lg,
    gap: space.md,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrow: { ...text.caption, color: palette.accent.success },
  question: { ...text.body, fontFamily: 'Nunito_700Bold', color: palette.content[0] },
  quote: { ...text.callout, color: palette.content[1] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.12)',
  },
  pillYes: { backgroundColor: tint.success(0.12), borderColor: tint.success(0.3) },
  pillText: { ...text.label, fontSize: 14, color: palette.content[1] },
  pillTextYes: { color: palette.accent.success },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resultText: { ...text.body, color: palette.content[0], flex: 1 },
});
