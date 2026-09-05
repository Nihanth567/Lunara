import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
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
 * What changed and why, since each of these was a small tell:
 *
 * - **Radius 12 → 20.** A 12pt corner on a 56pt-tall full-width button is the
 *   default every generated UI reaches for, and it reads stiff: corner radius
 *   has to scale with the surface it belongs to. 20 is soft enough to match a
 *   product about tenderness without becoming a pill, which on a full-width
 *   button reads generic-consumer.
 * - **A shadow.** The primary action was a flat coral rectangle. On a near-black
 *   ground a wide, soft, low-opacity black shadow is the only thing that makes
 *   an element look liftable rather than painted on.
 * - **One type step.** Primary was 16px and secondary 17px, for no reason. Both
 *   are `type.label` now.
 * - **Spring, not timing, on press.** `withTiming(0.97)` is a linear squash;
 *   a spring settles the way a physical control does. 0.96 is the floor before
 *   the press starts to read as a glitch.
 *
 * Accessibility: every variant declares `accessibilityRole="button"` and its
 * busy/disabled state, so the loading spinner is announced rather than being a
 * silent dead control. The ghost variant carries a minimum height because it has
 * no background to give it one — it was landing just under the 48pt floor.
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
    scale.value = withTiming(0.96, { duration: duration.instant });
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
      style={[animStyle, styles.wrapper, isPrimary && !disabled && elevation.lifted, style]}
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
          <ActivityIndicator color={isPrimary ? '#0A0817' : '#FF9A8B'} size="small" />
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
  base: {
    height: 56,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
  },
  primary: { backgroundColor: '#FF9A8B' },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.55)',
    // A faint wash rather than fully transparent, so the outline reads as a
    // control and not as a stray rule across the page.
    backgroundColor: 'rgba(255,154,139,0.08)',
  },
  label: type.label,
  primaryLabel: { color: '#0A0817' },
  secondaryLabel: { color: '#FF9A8B' },

  // Disabled primary keeps the coral identity at low emphasis. The old pairing
  // put #C0B8D4 text on a 16%-coral fill, which measured under 3:1.
  primaryDisabled: { backgroundColor: 'rgba(255,154,139,0.20)' },
  primaryDisabledLabel: { color: 'rgba(248,245,255,0.55)' },

  ghost: {
    minHeight: touchTarget,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  ghostText: {
    ...type.label,
    color: '#C0B8D4',
    textAlign: 'center',
  },
  dimmed: { opacity: 0.4 },
  dimmedText: { opacity: 0.4 },
});
