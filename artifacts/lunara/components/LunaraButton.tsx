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
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface LunaraButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LunaraButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: LunaraButtonProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[animStyle, styles.wrapper, style]}
      >
        <View style={[styles.primaryButton, disabled && styles.disabledButton]}>
          {loading ? (
            <ActivityIndicator color="#1A0E18" size="small" />
          ) : (
            <Text style={styles.primaryText}>{title}</Text>
          )}
        </View>
      </AnimatedPressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[animStyle, styles.wrapper, style]}
      >
        <View style={[styles.secondaryButton, disabled && styles.dimmed]}>
          {loading ? (
            <ActivityIndicator color="#FF9A8B" size="small" />
          ) : (
            <Text style={styles.secondaryText}>{title}</Text>
          )}
        </View>
      </AnimatedPressable>
    );
  }

  // Ghost
  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[animStyle, style]}
    >
      <Text style={[styles.ghostText, disabled && styles.dimmedText]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF9A8B',
  },
  primaryText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#1A0E18',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9A8B',
    backgroundColor: 'transparent',
  },
  secondaryText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#FF9A8B',
    letterSpacing: 0.2,
  },
  ghostText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'center',
    paddingVertical: 12,
  },
  dimmed: { opacity: 0.4 },
  disabledButton: { backgroundColor: '#704F58' },
  dimmedText: { opacity: 0.4 },
});
