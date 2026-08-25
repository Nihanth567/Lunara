import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const MILESTONE_COPY: Record<number, { title: string; body: string }> = {
  7: {
    title: 'One week, together',
    body: 'Seven nights of choosing to show up for each other. That’s no small thing.',
  },
  14: {
    title: 'Two weeks, steady',
    body: 'Fourteen nights of showing up, even on the ordinary ones. Keep going, gently.',
  },
  30: {
    title: 'A whole month',
    body: 'Thirty nights of never missing each other. What a quiet, beautiful streak you’ve built.',
  },
  60: {
    title: 'Two months, quietly',
    body: 'Sixty nights of turning toward each other instead of away. Ordinary nights, made into something steady.',
  },
  100: {
    title: 'One hundred nights',
    body: 'A hundred nights of choosing this, choosing each other. However far you go from here, this one is worth holding onto.',
  },
};

interface MilestoneBannerProps {
  milestone: number;
}

export function MilestoneBanner({ milestone }: MilestoneBannerProps) {
  const copy = MILESTONE_COPY[milestone] ?? {
    title: `${milestone} nights together`,
    body: 'A streak worth pausing to notice.',
  };

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 700 });
    scale.value = withSpring(1, { damping: 14, stiffness: 120 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.dotsRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.dot, { opacity: 0.25 + (i / 4) * 0.75 }]} />
        ))}
      </View>
      <Ionicons name="sparkles" size={22} color="#FFD6A5" />
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,214,165,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,165,0.25)',
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
  },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFD6A5' },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#F8F5FF', textAlign: 'center' },
  body: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#C9BFE0',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 6,
  },
});
