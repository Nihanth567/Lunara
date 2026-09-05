import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { fetchGrowGuidance, getGrowGuidance, type GrowSuggestion } from '@/lib/growGuidance';
import { radius } from '@/constants/tokens';

interface Props {
  growTexts: string[];
  /**
   * Fired once suggestions are actually on screen. The Grow check-back keys off
   * this rather than off the reveal itself, so a couple is only asked about
   * guidance they were really shown.
   */
  onShown?: () => void;
}

/** Soft, dismissible suggestions shown after both partners reveal their Grow notes — never critical, always optional. */
export function GrowGuidance({ growTexts, onShown }: Props) {
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
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="leaf-outline" size={16} color="#A8D8A8" />
          <Text style={styles.title}>A gentle way forward</Text>
        </View>
        <Pressable onPress={() => setDismissed(true)} hitSlop={10} style={styles.dismissBtn}>
          <Ionicons name="close" size={16} color="#948BAC" />
        </Pressable>
      </View>
      <Text style={styles.intro}>A few small, no-pressure ideas — take what’s useful, leave the rest.</Text>
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
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(168,216,168,0.18)',
    padding: 18,
    gap: 12,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#A8D8A8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dismissBtn: { padding: 2 },
  intro: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    lineHeight: 18,
  },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#A8D8A8',
    marginTop: 7,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#DCD1EF',
    lineHeight: 20,
  },
});
