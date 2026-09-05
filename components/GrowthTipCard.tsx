import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { GrowthTip } from '@/lib/growth';
import { radius } from '@/constants/tokens';

interface Props {
  tip: GrowthTip;
}

/**
 * "Growth Tip" callout shown below the completed daily prompt on Tonight — a
 * single small, actionable suggestion tied to the day's topic.
 */
export function GrowthTipCard({ tip }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={16} color="#F0C07A" />
        <Text style={styles.title}>Growth Tip</Text>
        <View style={styles.topicPill}>
          <Text style={styles.topicText}>{tip.topic}</Text>
        </View>
      </View>
      <Text style={styles.body}>{tip.tip}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    gap: 10,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F0C07A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  topicPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  topicText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C0B8D4',
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#DCD1EF',
    lineHeight: 21,
  },
});
