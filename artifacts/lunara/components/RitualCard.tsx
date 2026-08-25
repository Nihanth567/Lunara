import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export type CardType = 'grateful' | 'cute' | 'grow';

interface RitualCardProps {
  type: CardType;
  value: string;
  isExpanded: boolean;
  onExpand: () => void;
  onDone: () => void;
  onChange: (text: string) => void;
  isSubmitted?: boolean;
}

const CONFIG = {
  grateful: {
    title: 'Grateful',
    prompt: 'Something I love about you today...',
    helper: 'Share something specific you appreciated about your partner',
    icon: 'heart-outline' as const,
    color: '#FF9A8B',
    borderColor: 'rgba(255,154,139,0.35)',
    bgColor: 'rgba(255,154,139,0.07)',
    inputBg: 'rgba(255,154,139,0.05)',
  },
  cute: {
    title: 'Cute',
    prompt: 'A moment that made me smile because of you...',
    helper: 'A funny, sweet, or soft moment you noticed or shared',
    icon: 'happy-outline' as const,
    color: '#C3B1E1',
    borderColor: 'rgba(195,177,225,0.35)',
    bgColor: 'rgba(195,177,225,0.07)',
    inputBg: 'rgba(195,177,225,0.05)',
  },
  grow: {
    title: 'Grow',
    prompt: 'One thing we can grow together...',
    helper: 'A gentle, positive thing you would love to try or improve',
    icon: 'trending-up-outline' as const,
    color: '#A8D8A8',
    borderColor: 'rgba(168,216,168,0.35)',
    bgColor: 'rgba(168,216,168,0.07)',
    inputBg: 'rgba(168,216,168,0.05)',
  },
} as const;

export function RitualCard({
  type,
  value,
  isExpanded,
  onExpand,
  onDone,
  onChange,
  isSubmitted = false,
}: RitualCardProps) {
  const config = CONFIG[type];
  const inputRef = useRef<TextInput>(null);
  const progress = useSharedValue(isExpanded ? 1 : 0);
  const checkScale = useSharedValue(value.trim().length > 0 ? 1 : 0);
  const cardScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isExpanded ? 1 : 0, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
    });
    if (isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 320);
    }
  }, [isExpanded]);

  useEffect(() => {
    checkScale.value = withSpring(value.trim().length > 0 ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [value]);

  const expandedStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(progress.value, [0, 1], [0, 180], 'clamp'),
    opacity: progress.value,
    overflow: 'hidden',
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const cardScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handlePress = () => {
    if (isSubmitted) return;
    cardScale.value = withSpring(1, { damping: 10, stiffness: 300 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isExpanded) onExpand();
  };

  const handlePressIn = () => {
    if (!isExpanded) {
      cardScale.value = withTiming(0.98, { duration: 80 });
    }
  };

  const handlePressOut = () => {
    cardScale.value = withTiming(1, { duration: 100 });
  };

  const isFilled = value.trim().length > 0;

  return (
    <Animated.View style={[cardScaleStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isSubmitted}
      >
        <View
          style={[
            styles.card,
            {
              borderColor: isExpanded ? config.borderColor : 'rgba(255,255,255,0.08)',
              backgroundColor: '#1E1B3A',
            },
          ]}
        >
          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name={config.icon} size={20} color={config.color} />
              <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
            </View>

            <View style={styles.headerRight}>
              {isFilled && !isExpanded && (
                <Animated.View style={checkStyle}>
                  <Ionicons name="checkmark-circle" size={20} color={config.color} />
                </Animated.View>
              )}
              {isExpanded && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onDone();
                  }}
                  style={styles.doneButton}
                >
                  <Text style={[styles.doneText, { color: config.color }]}>Done</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Preview when filled and collapsed */}
          {isFilled && !isExpanded && (
            <Text style={styles.preview} numberOfLines={2}>
              {value}
            </Text>
          )}

          {/* Prompt when empty and collapsed */}
          {!isFilled && !isExpanded && (
            <Text style={styles.prompt}>{config.prompt}</Text>
          )}

          {/* Expanded input area */}
          <Animated.View style={expandedStyle}>
            <View style={styles.expandedContent}>
              {!isSubmitted && (
                <Text style={styles.helperText}>{config.helper}</Text>
              )}
              <TextInput
                ref={inputRef}
                value={value}
                onChangeText={onChange}
                placeholder={config.prompt}
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                style={[styles.input, { color: '#F8F5FF' }]}
                returnKeyType="done"
                onSubmitEditing={onDone}
                blurOnSubmit={false}
                editable={!isSubmitted}
              />
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  prompt: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 20,
  },
  preview: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },
  expandedContent: {
    gap: 8,
    paddingTop: 4,
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 17,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: Platform.OS === 'android' ? 4 : 0,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  doneText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
