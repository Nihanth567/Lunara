import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { GrowthTip } from '@/lib/growth';
import type { FollowUpResponse } from '@/hooks/useGrowth';
import { ConfettiBurst } from '@/components/ConfettiBurst';
import { radius } from '@/constants/tokens';
import { palette } from '@/constants/colors';

interface Props {
  tip: GrowthTip;
  connectionStreak: number;
  onRespond: (response: FollowUpResponse) => void;
  /** Called a couple seconds after answering, once the result has been seen. */
  onDismiss: () => void;
}

/**
 * Low-friction "did you try yesterday's tip?" card shown above today's prompt.
 * A "yes" fires a success haptic + confetti and (via the parent) bumps the
 * Connection Streak.
 */
export function GrowthFollowUpCard({ tip, connectionStreak, onRespond, onDismiss }: Props) {
  const [answer, setAnswer] = useState<FollowUpResponse | null>(null);
  const [confetti, setConfetti] = useState(0);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (dismissRef.current) clearTimeout(dismissRef.current);
  }, []);

  const handle = (response: FollowUpResponse) => {
    if (answer) return;
    setAnswer(response);
    dismissRef.current = setTimeout(onDismiss, 2600);
    if (response === 'yes') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfetti((c) => c + 1);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onRespond(response);
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.card}>
      <ConfettiBurst trigger={confetti} />

      {answer === null && (
        <>
          <View style={styles.header}>
            <Ionicons name="leaf-outline" size={16} color={palette.accent.success} />
            <Text style={styles.eyebrow}>Yesterday’s Growth Tip · {tip.topic}</Text>
          </View>
          <Text style={styles.prompt}>Did you get a chance to try yesterday’s growth tip?</Text>
          <Text style={styles.tipRef}>“{tip.tip}”</Text>
          <View style={styles.pills}>
            <Pressable style={[styles.pill, styles.pillYes]} onPress={() => handle('yes')}>
              <Ionicons name="sparkles" size={14} color={palette.accent.success} />
              <Text style={[styles.pillText, styles.pillTextYes]}>Yes, we did!</Text>
            </Pressable>
            <Pressable style={styles.pill} onPress={() => handle('later')}>
              <Text style={styles.pillText}>Maybe next time</Text>
            </Pressable>
          </View>
        </>
      )}

      {answer === 'yes' && (
        <View style={styles.resultRow}>
          <Ionicons name="flame" size={18} color={palette.accent.glow} />
          <Text style={styles.resultText}>
            Connection Streak: {connectionStreak} {connectionStreak === 1 ? 'day' : 'days'} — nicely done.
          </Text>
        </View>
      )}

      {answer === 'later' && (
        <View style={styles.resultRow}>
          <Ionicons name="moon-outline" size={16} color={palette.content[1]} />
          <Text style={styles.resultText}>No pressure — today’s a fresh chance.</Text>
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
    borderColor: 'rgba(247, 241, 232,0.08)',
    padding: 18,
    gap: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: palette.content[2],
    letterSpacing: 0.3,
  },
  prompt: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: palette.content[0],
    lineHeight: 21,
  },
  tipRef: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: palette.content[1],
    lineHeight: 19,
    fontStyle: 'italic',
  },
  pills: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
    backgroundColor: 'rgba(247, 241, 232,0.04)',
  },
  pillYes: {
    borderColor: 'rgba(125, 222, 181,0.3)',
    backgroundColor: 'rgba(125, 222, 181,0.08)',
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: palette.content[1],
  },
  pillTextYes: { color: palette.accent.success },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: palette.content[1],
    lineHeight: 19,
  },
});
