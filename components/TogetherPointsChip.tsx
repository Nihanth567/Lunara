import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  shouldShowTogetherPoints,
  togetherPointsLabel,
} from '@/lib/togetherPoints';
import { palette, tint } from '@/constants/colors';
import { radius, space } from '@/constants/tokens';
import { type as text, maxFontScale, tabularNumerals } from '@/constants/typography';

/**
 * The couple's running total of shared nights, as a small chip beside the fox.
 *
 * ─── Why it sits next to the streak rather than replacing it ─────────────────
 *
 * The streak answers "are we in a run right now", which is the question that
 * makes someone open the app tonight — and the question that makes a missed
 * Tuesday sting. This answers "how many nights have we done this", which the
 * streak cannot, because a broken run takes the number with it.
 *
 * Two numbers, one of which can fall and one of which cannot. That pairing is
 * the whole design: the streak carries the urgency, and this is what is still
 * standing underneath it on the morning after a run ends. A couple who have
 * had forty nights together and missed one should be able to see the forty.
 *
 * ─── Why violet and not gold ─────────────────────────────────────────────────
 *
 * Gold is the streak's, and apricot is reserved for the one thing on a screen
 * that wants acting on. This is neither — it is ambience, a fact about them
 * that asks for nothing. Violet is the token for exactly that, and the visual
 * quietness is doing product work: a second gold chip beside the first would
 * read as a second score to chase.
 */

interface Props {
  points: number;
  /**
   * Render even below the usual threshold. For the one surface (Us) that is
   * explicitly a page of statistics, where a small number is information
   * rather than a scoreboard opening at nil.
   */
  alwaysShow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TogetherPointsChip({ points, alwaysShow = false, style }: Props) {
  if (!alwaysShow && !shouldShowTogetherPoints(points)) return null;

  const label = togetherPointsLabel(points);

  return (
    <View
      style={[styles.chip, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Ionicons name="sparkles" size={12} color={palette.accent.moon} />
      <Text style={styles.text} maxFontSizeMultiplier={maxFontScale} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.moon(0.22),
    backgroundColor: tint.moon(0.1),
  },
  text: {
    ...text.caption,
    ...tabularNumerals,
    color: palette.accent.moon,
  },
});
