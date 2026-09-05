import { radius } from '@/constants/tokens';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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
    Haptics.impactAsync(
      response === 'yes' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    onRespond(response);
    dismissRef.current = setTimeout(onDismiss, 2600);
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(220)} style={styles.card}>
      {answer === null ? (
        <>
          <View style={styles.header}>
            <Ionicons name="leaf-outline" size={15} color="#A8D8A8" />
            <Text style={styles.eyebrow}>Yesterday’s Grow note</Text>
          </View>
          <Text style={styles.question}>{GROW_CHECK_BACK_QUESTION}</Text>
          <Text style={styles.quote} numberOfLines={2}>“{growText}”</Text>
          <View style={styles.pills}>
            {GROW_FOLLOW_UP_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.pill, { borderColor: option.color + '33' }]}
                onPress={() => handle(option.value)}
              >
                <Ionicons name={option.icon} size={13} color={option.color} />
                <Text style={[styles.pillText, { color: option.color }]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.resultRow}>
          <Ionicons name="leaf" size={16} color="#A8D8A8" />
          <Text style={styles.resultText}>{growFollowUpAcknowledgement(answer)}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(168,216,168,0.18)',
    padding: 18,
    gap: 9,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#948BAC',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  question: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F5F2FB',
    lineHeight: 21,
  },
  quote: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  resultText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#DCD1EF',
    lineHeight: 19,
  },
});
