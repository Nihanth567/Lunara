import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MoonPhaseIndicator, getMoonColor } from './MoonPhaseIndicator';

const MILESTONES = [7, 14, 30, 60, 100];

function nextMilestone(streak: number): number | null {
  return MILESTONES.find((m) => m > streak) ?? null;
}

function prevMilestone(streak: number): number {
  const passed = MILESTONES.filter((m) => m <= streak);
  return passed.length ? passed[passed.length - 1] : 0;
}

function milestoneName(m: number): string {
  switch (m) {
    case 7: return 'a full week';
    case 14: return 'two weeks';
    case 30: return 'a full month';
    case 60: return 'two months';
    case 100: return 'a hundred nights';
    default: return `${m} nights`;
  }
}

function getCaption(streak: number, longestStreak: number): { title: string; sub: string } {
  if (streak === 0 && longestStreak === 0) {
    return {
      title: 'Tonight, your story begins',
      sub: 'Complete tonight’s ritual together to light the first night',
    };
  }
  if (streak === 0) {
    return {
      title: 'A quiet stretch — and that’s alright',
      sub: 'Tonight is a fresh start, whenever you’re ready',
    };
  }
  const next = nextMilestone(streak);
  const title = `${streak} ${streak === 1 ? 'night' : 'nights'} of choosing each other`;
  if (!next) {
    return { title, sub: 'However far this goes, this is worth noticing' };
  }
  const remaining = next - streak;
  return {
    title,
    sub: `${remaining} more ${remaining === 1 ? 'night' : 'nights'} to ${milestoneName(next)}`,
  };
}

interface Props {
  streak: number;
  longestStreak: number;
}

/** Calm, prominent home-screen streak module — moon phase, gentle caption, soft progress toward the next milestone */
export function StreakSpotlight({ streak, longestStreak }: Props) {
  const next = nextMilestone(streak);
  const prev = prevMilestone(streak);
  const progress = next
    ? Math.min(1, Math.max(streak > 0 ? 0.04 : 0, (streak - prev) / (next - prev)))
    : 1;
  const { title, sub } = getCaption(streak, longestStreak);
  const tierColor = getMoonColor(streak);

  return (
    <View style={styles.container}>
      <MoonPhaseIndicator streak={streak} size="large" showLabel={false} />
      <View style={styles.captionWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      {streak > 0 && next && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: tierColor }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E1B3A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  captionWrap: {
    alignItems: 'center',
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    textAlign: 'center',
    lineHeight: 18,
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
