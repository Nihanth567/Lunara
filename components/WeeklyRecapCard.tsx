import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { WeeklyRecap } from '@/lib/growth';
import { radius } from '@/constants/tokens';

interface Props {
  recap: WeeklyRecap;
  isPro: boolean;
  onUnlock: () => void;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Weekly follow-up summary shown on Sundays in the Us tab. */
export function WeeklyRecapCard({ recap, isPro, onUnlock }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={16} color="#F0C07A" />
        <Text style={styles.title}>Sunday Recap</Text>
      </View>

      <View style={styles.statsRow}>
        <Stat value={recap.promptsCompleted} label="nights shared" />
        <View style={styles.statDivider} />
        <Stat value={recap.tipsTried} label="tips tried" />
        <View style={styles.statDivider} />
        <Stat value={recap.tipsViewed} label="tips seen" />
      </View>

      {!isPro && (
        <>
          <Text style={styles.teaser}>{recap.teaser}</Text>
          <Pressable
            style={styles.unlockBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onUnlock();
            }}
          >
            <Ionicons name="sparkles" size={15} color="#0A0817" />
            <Text style={styles.unlockText}>See full insights with Lunara Pro</Text>
          </Pressable>
        </>
      )}

      {isPro && (
        <View style={styles.insights}>
          {recap.proInsights.map((line, i) => (
            <View key={i} style={styles.insightRow}>
              <View style={styles.insightDot} />
              <Text style={styles.insightText}>{line}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
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
    gap: 14,
    marginBottom: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F0C07A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 3, flex: 1 },
  statNumber: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F5F2FB',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
  },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  teaser: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#DCD1EF',
    lineHeight: 21,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9A8B',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.35)',
  },
  unlockText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0A0817',
  },
  insights: { gap: 10 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F0C07A',
    marginTop: 7,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#DCD1EF',
    lineHeight: 20,
  },
});
