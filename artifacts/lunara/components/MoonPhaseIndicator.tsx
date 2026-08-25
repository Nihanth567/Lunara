import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  streak: number;
  size?: 'small' | 'large';
}

function getMoonColor(streak: number): string {
  if (streak === 0) return 'rgba(195,177,225,0.3)';
  if (streak < 7) return 'rgba(195,177,225,0.55)';
  if (streak < 14) return '#C3B1E1';
  if (streak < 30) return '#D4C5EE';
  return '#F0E8FF'; // full moon
}

function getMoonIcon(streak: number): 'moon-outline' | 'moon' {
  return streak >= 14 ? 'moon' : 'moon-outline';
}

function getMoonSize(size: 'small' | 'large', streak: number): number {
  const base = size === 'large' ? 36 : 22;
  return base;
}

/** Animated moon + streak counter that grows more luminous with streak */
export function MoonPhaseIndicator({ streak, size = 'small' }: Props) {
  const isLarge = size === 'large';
  const moonColor = getMoonColor(streak);
  const iconSize = getMoonSize(size, streak);
  return (
    <View style={[styles.container, isLarge && styles.containerLarge]}>
      <View>
        <Ionicons name={getMoonIcon(streak)} size={iconSize} color={moonColor} />
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.count, isLarge && styles.countLarge, { color: moonColor }]}>
          {streak}
        </Text>
        {isLarge && (
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  count: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#C3B1E1',
  },
  countLarge: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    lineHeight: 44,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },
});
