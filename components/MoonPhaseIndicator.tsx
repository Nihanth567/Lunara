import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  streak: number;
  size?: 'small' | 'large';
  /** Hides the "night(s) together" caption — used when a parent already supplies its own copy. */
  showLabel?: boolean;
}

/**
 * Streak color deepens through the same tier journey as the milestones
 * themselves — lavender through the first week, gold at two weeks, a soft
 * green as the month turns, coral through the two-month stretch, and a
 * near-white full moon once a hundred nights have gathered.
 */
export function getMoonColor(streak: number): string {
  if (streak === 0) return 'rgba(195,177,225,0.3)';
  if (streak < 7) return 'rgba(195,177,225,0.55)';
  if (streak < 14) return '#C3B1E1';
  if (streak < 30) return '#F0C07A';
  if (streak < 60) return '#A8D8A8';
  if (streak < 100) return '#FF9A8B';
  return '#F5F2FB'; // full moon, a hundred nights and beyond
}

function getMoonIcon(streak: number): 'moon-outline' | 'moon' {
  return streak >= 14 ? 'moon' : 'moon-outline';
}

function getMoonSize(size: 'small' | 'large'): number {
  return size === 'large' ? 36 : 22;
}

// Small constellation of stars that gathers around the moon as a streak grows —
// a quiet, non-gamey way of marking that something has been building over time.
const CONSTELLATION_POINTS = [
  { top: -6, left: -22 },
  { top: 8, left: 30 },
  { top: -18, left: 16 },
  { top: 22, left: -18 },
  { top: -26, left: -4 },
  { top: 24, left: 22 },
];

/** Animated moon + streak counter that grows more luminous with streak */
export function MoonPhaseIndicator({ streak, size = 'small', showLabel = true }: Props) {
  const isLarge = size === 'large';
  const moonColor = getMoonColor(streak);
  const iconSize = getMoonSize(size);
  const showConstellation = isLarge && streak >= 7;
  const starCount = streak >= 100 ? 6 : streak >= 60 ? 5 : streak >= 30 ? 4 : streak >= 14 ? 3 : 2;

  return (
    <View style={[styles.container, isLarge && styles.containerLarge]}>
      <View style={styles.moonWrap}>
        <View
          style={[
            styles.glow,
            {
              width: iconSize * 2.4,
              height: iconSize * 2.4,
              borderRadius: iconSize * 1.2,
              backgroundColor: moonColor,
              opacity: streak === 0 ? 0 : Math.min(0.16 + streak / 120, 0.32),
            },
          ]}
        />
        {showConstellation &&
          CONSTELLATION_POINTS.slice(0, starCount).map((point, i) => (
            <View
              key={i}
              style={[
                styles.star,
                { top: iconSize / 2 + point.top, left: iconSize / 2 + point.left, backgroundColor: moonColor },
              ]}
            />
          ))}
        <Ionicons name={getMoonIcon(streak)} size={iconSize} color={moonColor} />
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.count, isLarge && styles.countLarge, { color: moonColor }]}>
          {streak}
        </Text>
        {isLarge && showLabel && (
          <Text style={styles.label}>
            {streak === 1 ? 'night' : 'nights'} together
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  containerLarge: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  moonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  star: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  count: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#C3B1E1',
  },
  countLarge: {
    fontSize: 40,
    fontFamily: 'Fraunces_600SemiBold',
    lineHeight: 44,
  },
  label: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },
});
