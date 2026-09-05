import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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
const STAR_DATA = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  x: Math.random() * width,
  y: Math.random() * height * 1.2,
  size: Math.random() * 2.2 + 0.4,
  delay: Math.floor(Math.random() * 4000),
  duration: Math.floor(Math.random() * 2500) + 2000,
  baseOpacity: Math.random() * 0.5 + 0.1,
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
    backgroundColor: '#F5F2FB',
  },
});
