import { radius } from '@/constants/tokens';
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

function getCaption(
  streak: number,
  longestStreak: number,
  atRisk: boolean,
  isProtected: boolean,
): { title: string; sub: string } {
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

  const title = `${streak} ${streak === 1 ? 'night' : 'nights'} of choosing each other`;

  // A run that's being carried over a missed night says so plainly, once. It's
  // the difference between "you broke it" and "we kept it for you" — and the
  // second one is the reason anyone comes back on day 9.
  if (isProtected) {
    return {
      title,
      sub: atRisk
        ? 'One night off is already forgiven — tonight keeps it going'
        : 'One night off, quietly held. Still going.',
    };
  }

  // At risk is never framed as almost-lost. It's an open night, not a warning.
  if (atRisk) {
    const next = nextMilestone(streak);
    return {
      title,
      sub:
        next && next - streak === 1
          ? `Tonight makes it ${milestoneName(next)}`
          : 'Tonight’s still open — no rush',
    };
  }

  const next = nextMilestone(streak);
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
  /** A live run that tonight hasn't renewed yet. Softens the caption, never scolds. */
  atRisk?: boolean;
  /** The one missed night this run is stepping over, if there is one. */
  protectedNight?: boolean;
  /**
   * Quieter rendering for when tonight is still unfinished: the streak sits
   * *below* the ritual then, and a full-size module there would read as the
   * point of the screen rather than the reward for finishing it.
   */
  compact?: boolean;
}

/** Calm, prominent home-screen streak module — moon phase, gentle caption, soft progress toward the next milestone */
export function StreakSpotlight({
  streak,
  longestStreak,
  atRisk = false,
  protectedNight = false,
  compact = false,
}: Props) {
  const next = nextMilestone(streak);
  const prev = prevMilestone(streak);
  const progress = next
    ? Math.min(1, Math.max(streak > 0 ? 0.04 : 0, (streak - prev) / (next - prev)))
    : 1;
  const { title, sub } = getCaption(streak, longestStreak, atRisk, protectedNight);
  const tierColor = getMoonColor(streak);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <MoonPhaseIndicator streak={streak} size="small" showLabel={false} />
        <View style={styles.compactCaption}>
          <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.compactSub} numberOfLines={1}>{sub}</Text>
        </View>
      </View>
    );
  }

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
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30,27,58,0.55)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  compactCaption: { flex: 1, gap: 1 },
  compactTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#C0B8D4',
  },
  compactSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },
  container: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
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
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F5F2FB',
    textAlign: 'center',
  },
  sub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
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
