import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { KEEPSAKE_QUESTIONS } from '@/constants/keepsakeQuestions';
import { useApp } from '@/context/AppContext';

const ACCENTS = ['#FF9A8B', '#C3B1E1', '#A8D8A8', '#FFD6A5', '#A5C8FF'];

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
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.card, { borderColor: `${accent}40` }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={18} color={accent} />
        <Text style={[styles.cardPrompt, { color: accent }]}>{prompt}</Text>
      </View>

      {!mySubmitted && !editing && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEditing(true);
          }}
          style={styles.answerPrompt}
        >
          <Text style={styles.helperText}>{helper}</Text>
          <Text style={[styles.answerPromptText, { color: accent }]}>Write your answer</Text>
        </Pressable>
      )}

      {editing && (
        <View style={styles.editArea}>
          <Text style={styles.helperText}>{helper}</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Take your time..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            style={styles.input}
            autoFocus
          />
          <View style={styles.editActions}>
            <Pressable onPress={() => { setEditing(false); setDraft(myAnswer); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={!draft.trim() || saving} style={[styles.saveBtn, { backgroundColor: accent }]}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {mySubmitted && !editing && (
        <View style={styles.answersStack}>
          <View style={styles.answerBlock}>
            <View style={styles.answerMetaRow}>
              <Text style={styles.answerOwner}>You</Text>
              <Pressable onPress={() => setEditing(true)}>
                <Text style={[styles.editLink, { color: accent }]}>Edit</Text>
              </Pressable>
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
              <Ionicons name="moon-outline" size={14} color="#7A6D98" />
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
  const partnerName = couple?.partnerName ?? 'your partner';

  const answeredCount = keepsakes.filter((k) => k.mySubmitted).length;

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const shouldShowPaywall = isIntro && whoPays === 'me' && couple && !couple.isDemoMode && !couple.isSubscribed;
    if (shouldShowPaywall) {
      router.replace('/paywall');
    } else {
      router.back();
    }
  };

  return (
    <LinearGradient colors={['#0F0C29', '#1A1635', '#24243E']} style={styles.container}>
      <StarField />
      {!isIntro && (
        <Pressable style={[styles.closeButton, { top: insets.top + 12 }]} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#9B89C2" />
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (isIntro ? 24 : 60), paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="heart-outline" size={24} color="#FF9A8B" />
          <Text style={styles.title}>Your Keepsake</Text>
          <Text style={styles.subtitle}>
            {isIntro
              ? `A few small questions about ${partnerName === 'Waiting...' ? 'your partner' : partnerName} — answer at your own pace, whenever it feels right. Nothing here is timed.`
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
                <Pressable onPress={handleContinue} style={styles.skipBtn}>
                  <Text style={styles.skipText}>Skip for now — I&apos;ll come back to this</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={styles.footerNote}>
              {answeredCount} of {KEEPSAKE_QUESTIONS.length} answered
            </Text>
          )}
        </View>
      </ScrollView>
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
    borderRadius: 8,
    backgroundColor: '#1E1B3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 22, gap: 28 },
  header: { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#F8F5FF' },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    textAlign: 'center',
    lineHeight: 21,
  },
  questions: { gap: 14 },
  card: {
    backgroundColor: '#1E1B3A',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardPrompt: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', lineHeight: 21 },
  helperText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#7A6D98', lineHeight: 17 },
  answerPrompt: { gap: 6 },
  answerPromptText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  editArea: { gap: 10 },
  input: {
    backgroundColor: '#181532',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    minHeight: 90,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#F8F5FF',
    textAlignVertical: 'top',
    paddingTop: Platform.OS === 'android' ? 14 : 14,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, alignItems: 'center' },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#7A6D98' },
  saveBtn: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 8 },
  saveText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A0E18' },
  answersStack: { gap: 12 },
  answerBlock: { gap: 4 },
  answerMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  answerOwner: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#7A6D98', textTransform: 'uppercase', letterSpacing: 0.5 },
  editLink: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  answerText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#E8E0FF', lineHeight: 21 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waitingText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#7A6D98', flex: 1, lineHeight: 17 },
  footer: { gap: 12, alignItems: 'center' },
  footerNote: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#7A6D98' },
  skipBtn: { paddingVertical: 6 },
  skipText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#7A6D98' },
});
