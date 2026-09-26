import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { GrowthTip } from '@/lib/growth';
import { haptic } from '@/lib/haptics';
import { SpringPressable } from '@/components/SpringPressable';
import { palette, tint } from '@/constants/colors';
import { duration, radius, space, touchTarget } from '@/constants/tokens';
import { type as text } from '@/constants/typography';

interface Props {
  tip: GrowthTip;
  /** "I'll try it" — tomorrow's follow-up will ask how it went. */
  onTry: () => void;
  /** "Not now" — gone for today, and no follow-up. */
  onNotNow: () => void;
  /** Called once the card has finished (after the short thank-you, or straight away). */
  onDone: () => void;
}

/**
 * Today's small idea from lib/growth.ts — the lowest-priority item in the
 * single nudge slot (lib/nudge.ts), shown only once the night is revealed.
 *
 * Two choices and no third. "I'll try it" is what makes tomorrow's follow-up
 * mean something: it only ever asks about an idea someone actually picked.
 */
export function GrowthTipCard({ tip, onTry, onNotNow, onDone }: Props) {
  const [tried, setTried] = useState(false);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (doneRef.current) clearTimeout(doneRef.current);
  }, []);

  const tryIt = () => {
    if (tried) return;
    haptic.success();
    setTried(true);
    onTry();
    doneRef.current = setTimeout(onDone, 2200);
  };

  const notNow = () => {
    onNotNow();
    onDone();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(duration.base)}
      exiting={FadeOut.duration(duration.exit)}
      style={styles.card}
    >
      {tried ? (
        <View style={styles.ackRow}>
          <Ionicons name="heart" size={16} color={palette.accent.glow} />
          <Text style={styles.ackText}>Love it. We’ll check in tomorrow.</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Ionicons name="bulb-outline" size={16} color={palette.accent.glow} />
            <Text style={styles.eyebrow}>A little idea · {tip.topic}</Text>
          </View>
          <Text style={styles.body}>{tip.tip}</Text>
          <View style={styles.actions}>
            <SpringPressable onPress={tryIt} style={styles.tryBtn} haptic="none">
              <Text style={styles.tryText}>I’ll try it</Text>
            </SpringPressable>
            <SpringPressable onPress={notNow} style={styles.notNowBtn} hitSlop={8} feedback="highlight">
              <Text style={styles.notNowText}>Not now</Text>
            </SpringPressable>
          </View>
        </>
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
    borderColor: tint.glow(0.18),
    padding: space.lg,
    gap: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrow: { ...text.caption, color: palette.accent.glow, flex: 1 },
  body: { ...text.body, color: palette.content[0] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  tryBtn: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    justifyContent: 'center',
    backgroundColor: tint.glow(0.14),
    borderWidth: 1,
    borderColor: tint.glow(0.32),
  },
  tryText: { ...text.label, fontSize: 14, color: palette.accent.glow },
  notNowBtn: { minHeight: touchTarget, justifyContent: 'center' },
  notNowText: { ...text.label, fontSize: 14, color: palette.content[2] },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ackText: { ...text.body, color: palette.content[0], flex: 1 },
});
