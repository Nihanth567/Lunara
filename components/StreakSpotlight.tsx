import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MoonPhaseIndicator, getMoonColor } from './MoonPhaseIndicator';
import { radius, space } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';
import { type as text, tabularNumerals } from '@/constants/typography';

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
      title: 'Night one is right there',
      sub: 'Both of you finish tonight, and the fox lights up',
    };
  }
  if (streak === 0) {
    return {
      title: 'A quiet stretch — that’s allowed',
      sub: 'One shared night brings it all back',
    };
  }

  // The app says "Day N together" everywhere a streak is named: on the home
  // chip, on the reveal, in the share sheet. One phrase, so the number never
  // arrives wearing a different outfit depending on which screen it is on.
  const title = `Day ${streak} together`;

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
    gap: space.md,
    backgroundColor: tint.cream(0.04),
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.cream(0.06),
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginTop: space.lg + 4,
  },
  compactCaption: { flex: 1, gap: 1 },
  compactTitle: { ...text.caption, ...tabularNumerals, color: palette.content[1] },
  compactSub: { ...text.caption, color: palette.content[2] },

  container: {
    alignItems: 'center',
    gap: space.sm + 2,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.streak(0.14),
    paddingVertical: space.xl,
    paddingHorizontal: space.lg + 4,
    marginBottom: space.xl,
  },
  captionWrap: { alignItems: 'center', gap: space.xs },
  title: {
    ...text.heading,
    ...tabularNumerals,
    color: palette.content[0],
    textAlign: 'center',
  },
  sub: { ...text.caption, color: palette.content[2], textAlign: 'center', lineHeight: 18 },
  track: {
    width: '100%',
    height: 5,
    borderRadius: radius.xs,
    backgroundColor: tint.cream(0.07),
    overflow: 'hidden',
    marginTop: space.xs,
  },
  fill: { height: '100%', borderRadius: radius.xs },
});
