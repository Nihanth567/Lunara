import { radius } from '@/constants/tokens';
import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { palette } from '@/constants/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
  borderColor?: string;
  intensity?: number;
}

/** Frosted-glass card: BlurView on iOS, translucent View elsewhere */
export function GlassCard({
  children,
  style,
  innerStyle,
  borderColor = 'rgba(247, 241, 232,0.12)',
  intensity = 18,
}: GlassCardProps) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.base, { borderColor }, style]}
      >
        <View style={[styles.iosOverlay, innerStyle]}>{children}</View>
      </BlurView>
    );
  }

  return (
    <View style={[styles.base, styles.androidBase, { borderColor }, style]}>
      <View style={[{ flex: 1 }, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
  borderRadius: radius.md,
  borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  iosOverlay: {
    backgroundColor: palette.ink[2],
    flex: 1,
  },
  androidBase: {
    backgroundColor: palette.ink[2],
  },
});
