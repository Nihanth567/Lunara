import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { type, maxFontScale } from '@/constants/typography';
import { radius, elevation, space, duration, touchTarget } from '@/constants/tokens';
import { glow, palette, tint } from '@/constants/colors';
import { ThinkingOrb } from '@/components/ThinkingOrb';

interface LunaraButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Overrides the spoken label when `title` alone isn't descriptive. */
  accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The one button in Lunara.
 *
 * ─── It is a pill now, and that is a reversal ────────────────────────────────
 *
 * A previous pass moved this off a pill on the grounds that a full-width pill
 * is "generic-consumer". True, and beside the point: the reason to avoid a
 * default is that it says nothing, not that it is popular. This product is two
 * people keeping a small creature lit, the button is the warmest object on a
 * dark screen, and a rectangle with 20pt corners is a *dialog* button. The pill
 * is the friendlier shape and friendly is the brief, so it wins. What still
 * holds from that pass: nothing else in the app becomes a pill by default —
 * cards stay on the `radius` ramp.
 *
 * ─── The shadow is apricot, not black ────────────────────────────────────────
 *
 * A warm fill on a night ground with a black shadow reads as a sticker lying on
 * the page. The same fill with a shadow *in its own colour* reads as a source
 * of light, which is the entire visual thesis of the app — the fox's halo does
 * the same thing a hundred points above it. Android has no coloured shadow, so
 * it falls back to `elevation` and loses only the tint.
 *
 * ─── Still true from before ──────────────────────────────────────────────────
 *
 * - **One type step.** Primary and secondary are both `type.label`.
 * - **Spring, not timing, on release.** A spring settles the way a physical
 *   control does. 0.97 is the press floor — deep enough to feel, shallow enough
 *   that a big pill does not appear to flinch.
 *
 * Accessibility: every variant declares `accessibilityRole="button"` and its
 * busy/disabled state, so the loading indicator is announced rather than being
 * a silent dead control. The ghost variant carries a minimum height because it
 * has no background to give it one — it was landing just under the 48pt floor.
 */
export function LunaraButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: LunaraButtonProps) {
  const scale = useSharedValue(1);
  // Honour the OS "Reduce Motion" setting: the press still gives feedback via
  // the state layer and the haptic, it just doesn't move.
  const reduceMotion = useReducedMotion();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const inactive = disabled || loading;

  const handlePressIn = () => {
    if (reduceMotion || inactive) return;
    scale.value = withTiming(0.97, { duration: duration.instant });
  };

  const handlePressOut = () => {
    if (reduceMotion || inactive) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 260 });
  };

  const handlePress = () => {
    if (inactive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: accessibilityLabel ?? title,
    accessibilityState: { disabled: inactive, busy: loading },
  };

  if (variant === 'ghost') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={inactive}
        style={[animStyle, styles.ghost, style]}
        {...a11y}
      >
        <Text
          maxFontSizeMultiplier={maxFontScale}
          style={[styles.ghostText, disabled && styles.dimmedText]}
        >
          {title}
        </Text>
      </AnimatedPressable>
    );
  }

  const isPrimary = variant === 'primary';

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={inactive}
      style={[animStyle, styles.wrapper, isPrimary && !disabled && styles.primaryLift, style]}
      {...a11y}
    >
      <View
        style={[
          styles.base,
          isPrimary ? styles.primary : styles.secondary,
          disabled && (isPrimary ? styles.primaryDisabled : styles.dimmed),
        ]}
      >
        {loading ? (
          // `theme` maps directly onto the ink this button already used:
          // dark dots on the apricot primary fill, light dots on the dark
          // secondary fill — same contrast rule, no color prop needed.
          <ThinkingOrb
            state="working"
            size={20}
            theme={isPrimary ? 'light' : 'dark'}
            accessibilityLabel={`${title}, loading`}
          />
        ) : (
          <Text
            maxFontSizeMultiplier={maxFontScale}
            style={[
              styles.label,
              isPrimary ? styles.primaryLabel : styles.secondaryLabel,
              disabled && isPrimary && styles.primaryDisabledLabel,
            ]}
          >
            {title}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  /**
   * Apricot glow on iOS, plain elevation on Android.
   *
   * The radius is repeated here on purpose. This style sits on the Pressable
   * wrapper while the fill and its corners live on the inner `base` View, and a
   * shadow is cast from the bounds of the view that declares it — so without a
   * matching radius the glow draws a *square* halo behind a pill. It is not
   * decoration duplicated by accident; delete it and the button grows corners
   * made of light.
   */
  primaryLift: {
    ...elevation.lifted,
    ...glow.primary,
    borderRadius: radius.full,
    borderCurve: 'continuous' as const,
  },
  base: {
    height: 58,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
  },
  primary: { backgroundColor: palette.accent.glow },
  secondary: {
    borderWidth: 1,
    borderColor: tint.glow(0.45),
    // A faint wash rather than fully transparent, so the outline reads as a
    // control and not as a stray rule across the page.
    backgroundColor: tint.glow(0.08),
  },
  label: type.label,
  /** 11.44:1 on the apricot fill. */
  primaryLabel: { color: palette.ink[0] },
  secondaryLabel: { color: palette.accent.glow },

  // Disabled primary keeps the apricot identity at low emphasis rather than
  // going grey — a button that is not ready yet is still the same button.
  primaryDisabled: { backgroundColor: tint.glow(0.18) },
  primaryDisabledLabel: { color: tint.cream(0.55) },

  ghost: {
    minHeight: touchTarget,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  ghostText: {
    ...type.label,
    color: palette.content[1],
    textAlign: 'center',
  },
  dimmed: { opacity: 0.4 },
  dimmedText: { opacity: 0.4 },
});
