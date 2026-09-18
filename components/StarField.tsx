import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { palette } from '@/constants/colors';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Pre-generate star positions so they stay stable across renders
/*
 * Was 50 stars at up to 2.6px and 0.6 opacity, twinkling.
 *
 * A drifting starfield behind every screen is the other half of the cosmic-app
 * signature, and it actively fought the type: fine scattered specks sit in the
 * same visual register as text and make a page look noisy rather than deep.
 * What remains is 14 stars, sub-pixel-fine, at a fifth of the brightness —
 * enough that a dark page has some grain and isn't a flat void, not enough for
 * anyone to identify it as a starfield. If the design later wants no texture at
 * all, set this to 0 rather than deleting the component.
 */
const STAR_DATA = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height * 1.2,
  size: Math.random() * 1.1 + 0.4,
  delay: Math.floor(Math.random() * 6000),
  duration: Math.floor(Math.random() * 3500) + 3500,
  baseOpacity: Math.random() * 0.10 + 0.04,
}));

/** Individual animated star — own hook, avoids map-inside-hook rule */
function Star({ data }: { data: (typeof STAR_DATA)[0] }) {
  const opacity = useSharedValue(data.baseOpacity);

  useEffect(() => {
    opacity.value = withDelay(
      data.delay,
      withRepeat(
        withTiming(data.baseOpacity * 0.15, {
          duration: data.duration,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: data.x,
          top: data.y,
          width: data.size,
          height: data.size,
          borderRadius: data.size / 2,
        },
        animStyle,
      ]}
    />
  );
}

/** Renders a soft field of twinkling stars behind content */
export function StarField() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STAR_DATA.map((d) => (
        <Star key={d.id} data={d} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: palette.content[0],
  },
});
