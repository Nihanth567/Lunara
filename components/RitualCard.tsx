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
import colors, { palette, tint } from '@/constants/colors';
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

/**
 * The three prompts.
 *
 * ─── The names stay ──────────────────────────────────────────────────────────
 *
 * Grateful / Cute / Grow were considered for renaming to Warm / Spark / Gentle
 * grow. They kept their names: "Grateful" and "Cute" are already plain, warm,
 * non-clinical words, and the proposed replacements are *vaguer* — "Spark"
 * could be anything, "Cute" could only be one thing. Warmth in a product like
 * this comes from what the prompt asks, not from what the tab is called.
 *
 * ─── The helper text did not stay ────────────────────────────────────────────
 *
 * "Share something specific you appreciated about your partner" is a worksheet
 * instruction. It tells someone the shape of an acceptable answer, which is the
 * fastest way to make a person at 11pm feel graded. Every helper is now an
 * example or a permission — something that lowers the bar rather than setting
 * one. Nothing here uses the words "share", "reflect", "practice" or
 * "connection".
 *
 * Colours match the reveal exactly (heart / moon / success) so a prompt is the
 * same colour on the night you write it and the night you read it back.
 */
const CONFIG = {
  grateful: {
    title: 'Grateful',
    prompt: 'Something about you today…',
    helper: 'Tiny counts. The way they made coffee counts.',
    icon: 'heart-outline' as const,
    color: palette.accent.heart,
    borderColor: tint.heart(0.32),
    bgColor: tint.heart(0.07),
    inputBg: tint.heart(0.05),
  },
  cute: {
    title: 'Cute',
    prompt: 'A moment that made you smile…',
    helper: 'Silly is perfect here. Especially silly.',
    icon: 'happy-outline' as const,
    color: palette.accent.moon,
    borderColor: tint.moon(0.32),
    bgColor: tint.moon(0.07),
    inputBg: tint.moon(0.05),
  },
  grow: {
    title: 'Grow',
    prompt: 'One small thing for the two of you…',
    helper: 'No pressure — a wish is enough.',
    icon: 'leaf-outline' as const,
    color: palette.accent.success,
    borderColor: tint.success(0.32),
    bgColor: tint.success(0.07),
    inputBg: tint.success(0.05),
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
              borderColor: isExpanded ? config.borderColor : 'rgba(247, 241, 232,0.08)',
              backgroundColor: palette.ink[2],
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
                placeholderTextColor="rgba(247, 241, 232,0.25)"
                multiline
                style={[styles.input, { color: palette.content[0] }]}
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
                  <Ionicons name="lock-closed-outline" size={13} color={palette.content[2]} />
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
    backgroundColor: 'rgba(247, 241, 232,0.06)',
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
    borderColor: 'rgba(247, 241, 232,0.08)',
    backgroundColor: 'rgba(247, 241, 232,0.03)',
  },
  voiceLockedText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: palette.content[2] },
});
