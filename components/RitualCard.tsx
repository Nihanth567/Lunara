import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
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
import { VoiceNoteRecorder } from '@/components/VoiceNoteRecorder';
import { SpringPressable } from '@/components/SpringPressable';
import colors, { palette, tint } from '@/constants/colors';
import { type } from '@/constants/typography';
import { radius, space, touchTarget, pressScale } from '@/constants/tokens';

export type CardType = 'grateful' | 'cute' | 'grow';

interface RitualCardProps {
  type: CardType;
  value: string;
  isExpanded: boolean;
  onExpand: () => void;
  onDone: () => void;
  onChange: (text: string) => void;
  /** Tonight's question for this card (`lib/dailyPrompts.ts`). Falls back to a fixed one. */
  prompt?: string;
  isSubmitted?: boolean;
  /** Existing voice note for this card (Storage path, or file:// in demo mode). */
  voiceValue?: string | null;
  /** Its length, so the player can show a duration before the audio loads. */
  voiceDurationMs?: number | null;
  /** Omit to hide the recorder. */
  onRecordVoice?: (localUri: string, durationMs: number) => Promise<void> | void;
  onDeleteVoice?: () => Promise<void> | void;
  /**
   * Turn the recording into text for this card's written line. Omit to hide
   * the affordance — there is nothing to ask in demo mode.
   */
  onTranscribeVoice?: () => Promise<void> | void;
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
 * ─── One question, no helper text ───────────────────────────────────────────
 *
 * Each card asks tonight's question (`lib/dailyPrompts.ts`, a new wording every
 * night) and nothing else. The old helper line under it — "Tiny counts…" — was
 * a second sentence to read before the first word could be written. The
 * question is the only text; the input and the mic are the only controls.
 *
 * The `prompt` below is the fallback when no question is passed.
 *
 * Colours match the reveal exactly (heart / moon / success) so a prompt is the
 * same colour on the night you write it and the night you read it back.
 */
const CONFIG = {
  grateful: {
    title: 'Grateful',
    prompt: 'Something about you today…',
    icon: 'heart-outline' as const,
    color: palette.accent.heart,
    borderColor: tint.heart(0.32),
    bgColor: tint.heart(0.07),
    inputBg: tint.heart(0.05),
  },
  cute: {
    title: 'Cute',
    prompt: 'A moment that made you smile…',
    icon: 'happy-outline' as const,
    color: palette.accent.moon,
    borderColor: tint.moon(0.32),
    bgColor: tint.moon(0.07),
    inputBg: tint.moon(0.05),
  },
  grow: {
    title: 'Grow',
    prompt: 'One small thing for the two of you…',
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
  voiceDurationMs = null,
  onRecordVoice,
  onDeleteVoice,
  onTranscribeVoice,
  prompt: promptProp,
  doneLabel = 'Done',
}: RitualCardProps) {
  const config = CONFIG[type];
  const prompt = promptProp ?? config.prompt;
  const inputRef = useRef<TextInput>(null);
  const progress = useSharedValue(isExpanded ? 1 : 0);
  const checkScale = useSharedValue(value.trim().length > 0 ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isExpanded ? 1 : 0, {
      duration: 280,
      easing: Easing.inOut(Easing.ease),
    });
    if (!isExpanded) {
      // A collapsed card keeps its input mounted (at zero height), so without
      // this the input stayed focused after closing — the keyboard sat open
      // over a card nobody could see, typing into nothing.
      inputRef.current?.blur();
      return;
    }
    // Focus once the card has opened, so the keyboard arrives to a settled
    // layout and the scroll view measures the input where it will stay.
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(focusTimer);
  }, [isExpanded]);

  useEffect(() => {
    checkScale.value = withSpring(value.trim().length > 0 ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [value]);

  const expandedStyle = useAnimatedStyle(() => ({
    // Tall enough for the question, the input and a recorded note with its
    // actions. At 260 the voice row was clipped off the bottom of the card.
    maxHeight: interpolate(progress.value, [0, 1], [0, 460], 'clamp'),
    opacity: progress.value,
    overflow: 'hidden',
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const hasText = value.trim().length > 0;
  // A spoken answer is an answer. Either one completes the card.
  const isFilled = hasText || Boolean(voiceValue);

  return (
    /*
      The whole card is the tap target while it is closed, and only then. Once
      open it stops being a button — a card that sinks under your thumb every
      time you tap near the text you are writing is a card fighting you — and
      it stops being *one* accessibility element, so VoiceOver can reach the
      input, the Done button and the recorder inside it individually.
    */
    <SpringPressable
      onPress={onExpand}
      disabled={isSubmitted || isExpanded}
      dimWhenDisabled={false}
      scaleTo={pressScale.card}
      accessible={!isExpanded}
      accessibilityLabel={`${config.title}. ${isFilled ? 'Answered' : prompt}`}
      accessibilityHint={isSubmitted ? undefined : 'Opens this card to answer'}
    >
      <View
        style={[
          styles.card,
          {
            borderColor: isExpanded ? config.borderColor : tint.cream(0.08),
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
              <SpringPressable onPress={onDone} style={styles.doneButton}>
                <Text style={[styles.doneText, { color: config.color }]}>{doneLabel}</Text>
              </SpringPressable>
            )}
          </View>
        </View>

        {/* Preview when filled and collapsed */}
        {hasText && !isExpanded && (
          <Text style={styles.preview} numberOfLines={2}>
            {value}
          </Text>
        )}

        {/* Quiet marker that this card carries a recording too */}
        {voiceValue && !isExpanded && (
          <View style={styles.voiceBadge}>
            <Ionicons name="mic" size={11} color={config.color} />
            <Text style={[styles.voiceBadgeText, { color: config.color }]}>
              {hasText ? 'Plus a voice note' : 'Said out loud'}
            </Text>
          </View>
        )}

        {/* Prompt when empty and collapsed */}
        {!isFilled && !isExpanded && (
          <Text style={styles.prompt}>{prompt}</Text>
        )}

        {/* Expanded input area */}
        <Animated.View style={expandedStyle}>
          <View style={styles.expandedContent}>
            <Text style={styles.question}>{prompt}</Text>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChange}
              placeholder="Write it here…"
              placeholderTextColor={tint.cream(0.25)}
              multiline
              style={[styles.input, { color: palette.content[0] }]}
              returnKeyType="done"
              onSubmitEditing={onDone}
              blurOnSubmit={false}
              editable={!isSubmitted}
            />

            {/* Or say it: a recording answers the card on its own. */}
            {onRecordVoice && onDeleteVoice ? (
              <VoiceNoteRecorder
                value={voiceValue}
                durationMs={voiceDurationMs}
                color={config.color}
                onRecorded={onRecordVoice}
                onDelete={onDeleteVoice}
                onTranscribe={onTranscribeVoice}
                disabled={isSubmitted}
              />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </SpringPressable>
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
  question: {
    ...type.body,
    fontFamily: 'Nunito_700Bold',
    color: palette.content[0],
  },
  input: {
    ...type.prose,
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: Platform.OS === 'android' ? 4 : 0,
  },
  doneButton: {
    paddingHorizontal: space.lg,
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    justifyContent: 'center',
    backgroundColor: tint.cream(0.06),
  },
  doneText: {
    ...type.label,
  },
  voiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  voiceBadgeText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
});
