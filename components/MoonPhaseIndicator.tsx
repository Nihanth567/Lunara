import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type as text, tabularNumerals } from '@/constants/typography';
import { palette, tint } from '@/constants/colors';

interface Props {
  streak: number;
  size?: 'small' | 'large';
  /** Hides the "night(s) together" caption — used when a parent already supplies its own copy. */
  showLabel?: boolean;
}

/**
 * The streak's colour, and the single source of it.
 *
 * ─── The first fortnight is no longer grey ───────────────────────────────────
 *
 * This used to return translucent cream below 7 nights and a neutral below 14 —
 * so a couple's first two weeks, the stretch where encouragement matters most
 * and the habit is least established, rendered as a grey moon over a grey
 * number. Next to the warm card above it on the Tonight screen it did not read
 * as "early", it read as *disabled*. Night one now has a colour.
 *
 * The tiers still deepen as a journey — violet through the first week, gold at
 * one, apricot at two, a soft green as the month turns, pink through the
 * two-month stretch, and a near-white full moon once a hundred nights have
 * gathered — but every step of it is a colour rather than an absence of one.
 *
 * ─── Why this function is exported ───────────────────────────────────────────
 *
 * `CoupleCompanion` tints the fox's halo from the same streak. Its comment has
 * always claimed to follow this function "exactly, thresholds and all", and at
 * one point it did — then both were edited separately and they silently
 * diverged, which is how you end up with a violet fox above a gold moon
 * describing the same number on the same screen. It now calls this rather than
 * restating it, so the drift cannot happen again.
 */
export function getMoonColor(streak: number): string {
  if (streak === 0) return tint.cream(0.3);
  if (streak < 7) return palette.accent.moon;
  if (streak < 14) return palette.accent.streak;
  if (streak < 30) return palette.accent.glow;
  if (streak < 60) return palette.accent.success;
  if (streak < 100) return palette.accent.heart;
  return palette.content[0]; // full moon, a hundred nights and beyond
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
  count: { ...text.caption, ...tabularNumerals, color: palette.content[1] },
  countLarge: { ...text.hero, ...tabularNumerals },
  label: { ...text.callout, color: palette.content[2] },
});
