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
import { VoiceNoteRecorder } from '@/components/VoiceNoteRecorder';
import colors from '@/constants/colors';
import { type } from '@/constants/typography';
import { radius, space, touchTarget } from '@/constants/tokens';

export type CardType = 'grateful' | 'cute' | 'grow';

interface RitualCardProps {
  type: CardType;
  value: string;
  isExpanded: boolean;
  onExpand: () => void;
  onDone: () => void;
  onChange: (text: string) => void;
  isSubmitted?: boolean;
  /** Existing voice note for this card (Storage path, or file:// in demo mode). */
  voiceValue?: string | null;
  /** Omit to hide the recorder entirely (e.g. for a free account). */
  onRecordVoice?: (localUri: string) => Promise<void> | void;
  onDeleteVoice?: () => Promise<void> | void;
  /** Shown instead of the recorder when voice is a locked feature. */
  onVoiceLocked?: () => void;
  /**
   * Label for the confirm affordance. The Tonight screen passes "Next" while
   * there are still empty cards, so finishing the ritual is one continuous
   * pass rather than three separate open/close trips.
   */
  doneLabel?: string;
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
  voiceValue = null,
  onRecordVoice,
  onDeleteVoice,
  onVoiceLocked,
  doneLabel = 'Done',
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
    maxHeight: interpolate(progress.value, [0, 1], [0, 260], 'clamp'),
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
              backgroundColor: '#1A1730',
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
                  <Text style={[styles.doneText, { color: config.color }]}>{doneLabel}</Text>
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

          {/* Quiet marker that this card carries a recording too */}
          {voiceValue && !isExpanded && (
            <View style={styles.voiceBadge}>
              <Ionicons name="mic" size={11} color={config.color} />
              <Text style={[styles.voiceBadgeText, { color: config.color }]}>Voice note attached</Text>
            </View>
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
                style={[styles.input, { color: '#F5F2FB' }]}
                returnKeyType="done"
                onSubmitEditing={onDone}
                blurOnSubmit={false}
                editable={!isSubmitted}
              />

              {/* Optional voice note — never required, never blocks submitting */}
              {onRecordVoice && onDeleteVoice ? (
                <VoiceNoteRecorder
                  value={voiceValue}
                  color={config.color}
                  onRecorded={onRecordVoice}
                  onDelete={onDeleteVoice}
                  disabled={isSubmitted}
                />
              ) : onVoiceLocked ? (
                <Pressable onPress={onVoiceLocked} style={styles.voiceLocked}>
                  <Ionicons name="lock-closed-outline" size={13} color="#948BAC" />
                  <Text style={styles.voiceLockedText}>Add a voice note with Lunara Pro</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: space.xl,
    gap: space.md,
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
    ...type.heading,
  },
  prompt: {
    ...type.callout,
    color: colors.dark.onCardMuted,
  },
  preview: {
    ...type.prose,
    color: colors.dark.onCardBody,
  },
  expandedContent: {
    gap: 8,
    paddingTop: 4,
  },
  helperText: {
    ...type.caption,
    color: colors.dark.onCardMuted,
  },
  input: {
    ...type.prose,
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: Platform.OS === 'android' ? 4 : 0,
  },
  doneButton: {
    paddingHorizontal: space.lg,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  doneText: {
    ...type.label,
  },
  voiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  voiceBadgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  voiceLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  voiceLockedText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#948BAC' },
});
