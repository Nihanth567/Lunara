import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, Keyboard, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { SpringPressable } from '@/components/SpringPressable';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { haptic } from '@/lib/haptics';
import { KEEPSAKE_QUESTIONS } from '@/constants/keepsakeQuestions';
import { useApp } from '@/context/AppContext';
import { partnerLabel } from '@/lib/partner';
import { duration, hitSlopFor, pressScale, radius } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';

/**
 * The colour a keepsake question is tagged with, by index. Every value is a
 * palette token — the list used to end on a stray `#A5C8FF`, a blue that
 * existed nowhere else in the app and so read as a bug rather than a category.
 */
const ACCENTS = [
  palette.accent.heart,
  palette.accent.moon,
  palette.accent.success,
  palette.accent.streak,
  palette.partners.b,
];

function QuestionCard({
  index,
  prompt,
  helper,
  icon,
  myAnswer,
  partnerAnswer,
  mySubmitted,
  partnerSubmitted,
  partnerName,
  onSave,
}: {
  index: number;
  prompt: string;
  helper: string;
  icon: string;
  myAnswer: string;
  partnerAnswer: string;
  mySubmitted: boolean;
  partnerSubmitted: boolean;
  partnerName: string;
  onSave: (value: string) => Promise<void>;
}) {
  const accent = ACCENTS[index % ACCENTS.length];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(myAnswer);
  const [saving, setSaving] = useState(false);
  const bothRevealed = mySubmitted && partnerSubmitted;

  const handleSave = async () => {
    if (!draft.trim() || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      await onSave(draft.trim());
      // Only once it has actually saved — this used to buzz "success" on the
      // tap, then fail silently with the editor still open.
      haptic.success();
      setEditing(false);
    } catch {
      haptic.error();
      Alert.alert(
        'That didn’t save',
        'Your answer is still here — check your connection and try once more.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={[styles.card, { borderColor: `${accent}40` }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={18} color={accent} />
        <Text style={[styles.cardPrompt, { color: accent }]}>{prompt}</Text>
      </View>

      {!mySubmitted && !editing && (
        <SpringPressable
          onPress={() => setEditing(true)}
          style={styles.answerPrompt}
          scaleTo={pressScale.card}
        >
          <Text style={styles.helperText}>{helper}</Text>
          <Text style={[styles.answerPromptText, { color: accent }]}>Write your answer</Text>
        </SpringPressable>
      )}

      {editing && (
        <View style={styles.editArea}>
          <Text style={styles.helperText}>{helper}</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Take your time..."
            placeholderTextColor={tint.cream(0.25)}
            multiline
            style={styles.input}
            autoFocus
          />
          <View style={styles.editActions}>
            <SpringPressable
              onPress={() => {
                Keyboard.dismiss();
                setEditing(false);
                setDraft(myAnswer);
              }}
              style={styles.cancelBtn}
              feedback="highlight"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </SpringPressable>
            <SpringPressable
              onPress={handleSave}
              disabled={!draft.trim() || saving}
              // Saving is busy, not unavailable — only an empty answer dims.
              dimWhenDisabled={!draft.trim()}
              // Success fires once the save lands, not on the tap.
              haptic="none"
              accessibilityState={{ busy: saving }}
              style={[styles.saveBtn, { backgroundColor: accent }]}
            >
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </SpringPressable>
          </View>
        </View>
      )}

      {mySubmitted && !editing && (
        <View style={styles.answersStack}>
          <View style={styles.answerBlock}>
            <View style={styles.answerMetaRow}>
              <Text style={styles.answerOwner}>You</Text>
              <SpringPressable
                onPress={() => setEditing(true)}
                feedback="highlight"
                hitSlop={hitSlopFor(20)}
                accessibilityLabel="Edit your answer"
              >
                <Text style={[styles.editLink, { color: accent }]}>Edit</Text>
              </SpringPressable>
            </View>
            <Text style={styles.answerText}>{myAnswer}</Text>
          </View>

          {bothRevealed ? (
            <View style={styles.answerBlock}>
              <Text style={styles.answerOwner}>{partnerName}</Text>
              <Text style={styles.answerText}>{partnerAnswer}</Text>
            </View>
          ) : (
            <View style={styles.waitingRow}>
              <Ionicons name="moon-outline" size={14} color={palette.content[2]} />
              <Text style={styles.waitingText}>
                Kept safe until {partnerName} answers this one too
              </Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

export default function KeepsakesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ intro?: string }>();
  const isIntro = params.intro === '1';
  const { keepsakes, saveKeepsakeAnswer, couple, whoPays } = useApp();
  const partnerName = partnerLabel(couple);

  const answeredCount = keepsakes.filter((k) => k.mySubmitted).length;

  const handleContinue = () => {
    const shouldShowPaywall = isIntro && whoPays === 'me' && couple && !couple.isDemoMode && !couple.isSubscribed;
    if (shouldShowPaywall) {
      router.replace('/(modals)/paywall');
    } else {
      router.back();
    }
  };

  return (
    <LinearGradient colors={[palette.ink[0], palette.ink[1], palette.ink[3]]} style={styles.container}>
      <StarField />
      {!isIntro && (
        <SpringPressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={() => router.back()}
          scaleTo={pressScale.icon}
          hitSlop={hitSlopFor(38)}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={palette.content[1]} />
        </SpringPressable>
      )}

      {/* Long answers, multiline: the field being written follows its caret
          above the keyboard, with the Save row kept in view beneath it. */}
      <KeyboardAwareScrollViewCompat
        bottomOffset={56}
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (isIntro ? 24 : 60), paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="heart-outline" size={24} color={palette.accent.glow} />
          <Text style={styles.title}>Your Keepsake</Text>
          <Text style={styles.subtitle}>
            {isIntro
              ? `A few small questions about ${partnerName} — answer at your own pace, whenever it feels right. Nothing here is timed.`
              : 'The little things you both keep close, gathered in one soft place.'}
          </Text>
        </View>

        <View style={styles.questions}>
          {KEEPSAKE_QUESTIONS.map((q, index) => {
            const answer = keepsakes.find((k) => k.questionKey === q.key);
            return (
              <QuestionCard
                key={q.key}
                index={index}
                prompt={q.prompt}
                helper={q.helper}
                icon={q.icon}
                myAnswer={answer?.myAnswer ?? ''}
                partnerAnswer={answer?.partnerAnswer ?? ''}
                mySubmitted={answer?.mySubmitted ?? false}
                partnerSubmitted={answer?.partnerSubmitted ?? false}
                partnerName={partnerName}
                onSave={(value) => saveKeepsakeAnswer(q.key, value)}
              />
            );
          })}
        </View>

        <View style={styles.footer}>
          {isIntro ? (
            <>
              <LunaraButton
                title={answeredCount > 0 ? 'Continue' : 'Continue to Lunara'}
                onPress={handleContinue}
              />
              {answeredCount === 0 && (
                <SpringPressable onPress={handleContinue} style={styles.skipBtn} feedback="highlight">
                  <Text style={styles.skipText}>Skip for now — I&apos;ll come back to this</Text>
                </SpringPressable>
              )}
            </>
          ) : (
            <Text style={styles.footerNote}>
              {answeredCount} of {KEEPSAKE_QUESTIONS.length} answered
            </Text>
          )}
        </View>
      </KeyboardAwareScrollViewCompat>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeButton: {
    position: 'absolute',
    right: 22,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: palette.ink[2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 22, gap: 28 },
  header: { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', color: palette.content[0] },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 21,
  },
  questions: { gap: 14 },
  card: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardPrompt: { flex: 1, fontSize: 14, fontFamily: 'Nunito_700Bold', lineHeight: 21 },
  helperText: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2], lineHeight: 17 },
  answerPrompt: { gap: 6 },
  answerPromptText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  editArea: { gap: 10 },
  input: {
    backgroundColor: palette.ink[1],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tint.cream(0.1),
    padding: 14,
    minHeight: 90,
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[0],
    textAlignVertical: 'top',
    paddingTop: Platform.OS === 'android' ? 14 : 14,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, alignItems: 'center' },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText: { fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[2] },
  saveBtn: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: radius.lg },
  saveText: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: palette.ink[0] },
  answersStack: { gap: 12 },
  answerBlock: { gap: 4 },
  answerMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  answerOwner: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: palette.content[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  editLink: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
  answerText: { fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[1], lineHeight: 21 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waitingText: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2], flex: 1, lineHeight: 17 },
  footer: { gap: 12, alignItems: 'center' },
  footerNote: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2] },
  skipBtn: { paddingVertical: 6 },
  skipText: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2] },
});
