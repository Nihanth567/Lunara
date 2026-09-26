import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { fetchGrowGuidance, getGrowGuidance, type GrowSuggestion } from '@/lib/growGuidance';
import { SpringPressable } from '@/components/SpringPressable';
import { duration, pressScale, radius } from '@/constants/tokens';
import { palette } from '@/constants/colors';

interface Props {
  growTexts: string[];
  /**
   * Fired once suggestions are actually on screen. The Grow check-back keys off
   * this rather than off the reveal itself, so a couple is only asked about
   * guidance they were really shown.
   */
  onShown?: () => void;
  /** The close button. The slot records it so tonight's guidance doesn't come back. */
  onDismiss?: () => void;
}

/**
 * "How to grow", drawn from tonight's own Grow notes — the second-priority item
 * in the single nudge slot on Tonight (lib/nudge.ts), after the night is
 * revealed. It used to sit inside the reveal itself, under the Grow answers;
 * it moved so a night has one growth surface, not two.
 */
export function GrowGuidance({ growTexts, onShown, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);
  // Templates render immediately; the model's version swaps in if it arrives.
  // `fetchGrowGuidance` never rejects, so there is no failure branch here.
  const [suggestions, setSuggestions] = useState<GrowSuggestion[]>(() => getGrowGuidance(growTexts));

  useEffect(() => {
    let cancelled = false;
    fetchGrowGuidance(growTexts).then((result) => {
      if (cancelled || result.suggestions.length === 0) return;
      setSuggestions(result.suggestions);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSuggestions = suggestions.length > 0;
  const shownRef = useRef(false);
  useEffect(() => {
    if (shownRef.current || !hasSuggestions || dismissed) return;
    shownRef.current = true;
    onShown?.();
  }, [hasSuggestions, dismissed, onShown]);

  if (dismissed || !hasSuggestions) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(duration.base)}
      exiting={FadeOut.duration(duration.exit)}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="leaf-outline" size={16} color={palette.accent.success} />
          <Text style={styles.title}>A gentle way forward</Text>
        </View>
        <SpringPressable
          onPress={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          hitSlop={14}
          scaleTo={pressScale.icon}
          style={styles.dismissBtn}
          accessibilityLabel="Not now"
        >
          <Ionicons name="close" size={16} color={palette.content[2]} />
        </SpringPressable>
      </View>
      <View style={styles.list}>
        {suggestions.map((s) => (
          <View key={s.id} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.rowText}>{s.text}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(125, 222, 181,0.18)',
    padding: 18,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    color: palette.accent.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dismissBtn: { padding: 2 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: palette.accent.success,
    marginTop: 7,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
    lineHeight: 20,
  },
});
