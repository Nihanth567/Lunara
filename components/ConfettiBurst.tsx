import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  /** Bump this to replay the burst. */
  trigger: number;
  onDone?: () => void;
}

const COLORS = ['#E8A0B4', '#CBB9C9', '#9BC9A8', '#E8B98A', '#F8F1F6'];
const PIECES = 16;

function Piece({ index, trigger, onLast }: { index: number; trigger: number; onLast?: () => void }) {
  const progress = useSharedValue(0);
  const angle = (index / PIECES) * Math.PI * 2;
  const distance = 70 + (index % 4) * 22;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance - 30;
  const color = COLORS[index % COLORS.length];

  useEffect(() => {
    if (trigger === 0) return;
    progress.value = 0;
    progress.value = withDelay(
      (index % 5) * 18,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished && index === PIECES - 1 && onLast) runOnJS(onLast)();
      }),
    );
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.15 ? progress.value / 0.15 : 1 - (progress.value - 0.15) / 0.85,
    transform: [
      { translateX: dx * progress.value },
      { translateY: dy * progress.value + 40 * progress.value * progress.value },
      { rotate: `${progress.value * (index % 2 ? 320 : -320)}deg` },
      { scale: 0.6 + 0.4 * Math.sin(progress.value * Math.PI) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        { backgroundColor: color, borderRadius: index % 3 === 0 ? 6 : 2 },
        style,
      ]}
    />
  );
}

/** Small, self-contained celebratory burst — no native deps. */
export function ConfettiBurst({ trigger, onDone }: Props) {
  if (trigger === 0) return null;
  return (
    <View pointerEvents="none" style={styles.container}>
      {Array.from({ length: PIECES }).map((_, i) => (
        <Piece key={`${trigger}-${i}`} index={i} trigger={trigger} onLast={onDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  piece: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
});
