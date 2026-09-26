import { duration, radius } from '@/constants/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SpringPressable } from '@/components/SpringPressable';
import { haptic } from '@/lib/haptics';
import { palette, tint } from '@/constants/colors';
import {
  GROW_CHECK_BACK_QUESTION,
  GROW_FOLLOW_UP_OPTIONS,
  growFollowUpAcknowledgement,
  type GrowFollowUpResponse,
} from '@/lib/growCheckBack';

interface Props {
  /** The Grow note this is checking back on. */
  growText: string;
  onRespond: (response: GrowFollowUpResponse) => void;
  /** Called once the acknowledgement has been read. */
  onDismiss: () => void;
}

/**
 * One question, three taps, then it goes away. Deliberately the smallest
 * possible surface — no text field, no follow-on, no streak attached — so
 * "not yet" costs a couple exactly as little as "yes" does.
 */
export function GrowCheckBackCard({ growText, onRespond, onDismiss }: Props) {
  const [answer, setAnswer] = useState<GrowFollowUpResponse | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (dismissRef.current) clearTimeout(dismissRef.current);
  }, []);

  const handle = (response: GrowFollowUpResponse) => {
    if (answer) return;
    setAnswer(response);
    // "We did it" is a small win; any other answer is just a choice.
    if (response === 'yes') haptic.success();
    else haptic.selection();
    onRespond(response);
    dismissRef.current = setTimeout(onDismiss, 2600);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(duration.base)}
      exiting={FadeOut.duration(duration.exit)}
      style={styles.card}
    >
      {answer === null ? (
        <>
          <View style={styles.header}>
            <Ionicons name="leaf-outline" size={15} color={palette.accent.success} />
            <Text style={styles.eyebrow}>Yesterday’s Grow note</Text>
          </View>
          <Text style={styles.question}>{GROW_CHECK_BACK_QUESTION}</Text>
          <Text style={styles.quote} numberOfLines={2}>“{growText}”</Text>
          <View style={styles.pills}>
            {GROW_FOLLOW_UP_OPTIONS.map((option) => (
              <SpringPressable
                key={option.value}
                style={[styles.pill, { borderColor: option.color + '33' }]}
                onPress={() => handle(option.value)}
                haptic="none"
              >
                <Ionicons name={option.icon} size={13} color={option.color} />
                <Text style={[styles.pillText, { color: option.color }]}>{option.label}</Text>
              </SpringPressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.resultRow}>
          <Ionicons name="leaf" size={16} color={palette.accent.success} />
          <Text style={styles.resultText}>{growFollowUpAcknowledgement(answer)}</Text>
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
    borderColor: 'rgba(125, 222, 181,0.18)',
    padding: 18,
    gap: 9,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[2],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  question: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: palette.content[0],
    lineHeight: 21,
  },
  quote: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
    lineHeight: 19,
    fontStyle: 'italic',
  },
  pills: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: tint.cream(0.04),
  },
  pillText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  resultText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
    lineHeight: 19,
  },
});
