import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SpringPressable } from '@/components/SpringPressable';
import { palette, tint } from '@/constants/colors';
import { duration, radius, space, touchTarget } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

interface Props {
  /** A small glyph in a soft well. Ignored when `art` is given. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Richer art in place of the icon — usually the fox at `md`. */
  art?: React.ReactNode;
  title: string;
  /** One short warm line. If it needs a second sentence, the title is wrong. */
  body?: string;
  /** The one thing worth doing next, if there is one. */
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

/**
 * Nothing here yet — said kindly, with a way forward.
 *
 * Every empty screen in the app had written its own: a different icon size, a
 * different gap, a hardcoded translucent cream, and on most of them no action
 * at all, so the answer to "what now?" was to guess. The shape is now fixed —
 * art, one title, one line, one action — and only the words change.
 *
 * The action is apricot because apricot is the colour that means "act on
 * this", and it hugs its label rather than spanning the screen: an empty state
 * is an invitation, not a form.
 */
export function EmptyState({ icon = 'moon-outline', art, title, body, action, style }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={[styles.container, style]}>
      {art ?? (
        <View style={styles.iconWell}>
          <Ionicons name={icon} size={24} color={palette.content[1]} />
        </View>
      )}
      <View style={styles.copy}>
        <Text style={styles.title} maxFontSizeMultiplier={maxFontScale}>
          {title}
        </Text>
        {body ? (
          <Text style={styles.body} maxFontSizeMultiplier={maxFontScale}>
            {body}
          </Text>
        ) : null}
      </View>
      {action ? (
        <SpringPressable onPress={action.onPress} style={styles.action}>
          <Text style={styles.actionText} maxFontSizeMultiplier={maxFontScale}>
            {action.label}
          </Text>
          <Ionicons name="arrow-forward" size={15} color={palette.accent.glow} />
        </SpringPressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space.lg,
    paddingTop: space.xxxl,
    paddingHorizontal: space.lg,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: tint.cream(0.06),
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: space.sm, alignItems: 'center' },
  title: { ...text.heading, color: palette.content[0], textAlign: 'center' },
  body: {
    ...text.callout,
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget,
    paddingHorizontal: space.xl,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    backgroundColor: tint.glow(0.1),
    borderWidth: 1,
    borderColor: tint.glow(0.28),
  },
  actionText: { ...text.label, fontSize: 14, color: palette.accent.glow },
});
