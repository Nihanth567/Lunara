import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ThinkingOrb } from '@/components/ThinkingOrb';
import { palette } from '@/constants/colors';
import { duration, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

interface Props {
  /** Spoken to VoiceOver. Say what is loading, not that something is. */
  accessibilityLabel?: string;
  /** One optional quiet line under the orb, for waits long enough to explain. */
  caption?: string;
  /** Fill the screen on the night ground (the default), or sit inline. */
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * What a wait looks like in Lunara.
 *
 * The breathing orb rather than a system spinner: a spinner says "working",
 * and on a screen whose whole mood is a quiet room at night, the honest thing
 * to show while nobody has asked for anything is something slowly breathing.
 *
 * It arrives after a beat. Most loads here finish in a couple of hundred
 * milliseconds, and a loader that flashes on and straight off again is worse
 * than a blank frame — it reads as a stutter. Anything that takes longer fades
 * the orb in gently, so a slow network looks calm rather than broken.
 */
export function ScreenLoading({
  accessibilityLabel = 'Loading Lunara',
  caption,
  fullScreen = true,
  style,
}: Props) {
  return (
    <View style={[fullScreen ? styles.screen : styles.inline, style]}>
      <Animated.View
        entering={FadeIn.delay(duration.base).duration(duration.base)}
        style={styles.stack}
      >
        <ThinkingOrb
          state="breathing"
          size={64}
          theme="dark"
          accessibilityLabel={accessibilityLabel}
        />
        {caption ? (
          <Text style={styles.caption} maxFontSizeMultiplier={maxFontScale}>
            {caption}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.ink[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxl },
  stack: { alignItems: 'center', gap: space.lg },
  caption: { ...text.callout, color: palette.content[2], textAlign: 'center' },
});
