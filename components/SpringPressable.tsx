import React from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptic as haptics } from '@/lib/haptics';
import { pressScale, spring } from '@/constants/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /**
   * `scale` — the control sinks under the finger. Buttons, cards, chips.
   * `highlight` — the control dims and stays put. Grouped settings rows and
   * inline text links, where a row shrinking away from its neighbours reads
   * as the list coming apart.
   */
  feedback?: 'scale' | 'highlight';
  /** Press floor. Defaults to `pressScale.button`; use `pressScale.card` for big surfaces. */
  scaleTo?: number;
  /** Which word from `lib/haptics.ts` the tap says. `none` when the caller fires its own. */
  haptic?: 'tap' | 'selection' | 'none';
  /**
   * Dim when disabled. On by default so a control that can't be used looks it.
   * Turn it off only where the component draws its own disabled look (the
   * primary button keeps its apricot identity at low emphasis) or where
   * "disabled" really means "done" and should keep its colour.
   */
  dimWhenDisabled?: boolean;
}

/**
 * The one pressable in Lunara.
 *
 * Before this, press feedback was whatever each screen happened to write: the
 * primary button sprang, a ritual card eased on a timing curve, the list rows
 * ran a fixed sequence, and most other controls — the reveal button, the
 * nudge, the reactions, every settings row, the paywall plans — had no press
 * state at all. A control that doesn't answer the finger is the fastest tell
 * that an interface was assembled rather than made.
 *
 * What it does:
 *
 * - **Springs both ways** (`spring.pressIn` / `spring.release` in tokens), so
 *   the press lands immediately and the release settles like a physical key.
 * - **Fires its haptic on the tap, not the touch-down**, so a scroll that
 *   starts on a card doesn't buzz.
 * - **Disabled is inert and looks it.** No spring, no haptic, dimmed unless the
 *   caller owns its disabled look.
 * - **Reduce Motion keeps the feedback and drops the movement.** The dim still
 *   happens; the scale does not.
 */
export function SpringPressable({
  feedback = 'scale',
  scaleTo = pressScale.button,
  haptic = 'tap',
  dimWhenDisabled = true,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  style,
  children,
  accessibilityRole = 'button',
  accessibilityState,
  ...rest
}: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const inactive = Boolean(disabled);

  const animatedStyle = useAnimatedStyle(() => {
    const p = pressed.value;
    if (feedback === 'highlight') {
      return { opacity: Math.min(1, 1 - 0.4 * p) };
    }
    return {
      opacity: Math.min(1, 1 - 0.1 * p),
      transform: [{ scale: reduceMotion ? 1 : 1 - (1 - scaleTo) * p }],
    };
  });

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!inactive) pressed.value = withSpring(1, spring.pressIn);
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    pressed.value = withSpring(0, spring.release);
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (inactive) return;
    if (haptic === 'tap') haptics.tap();
    else if (haptic === 'selection') haptics.selection();
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: inactive, ...accessibilityState }}
      style={[style, animatedStyle, inactive && dimWhenDisabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
