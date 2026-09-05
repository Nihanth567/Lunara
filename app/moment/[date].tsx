import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { VoiceNotePlayer } from '@/components/VoiceNotePlayer';
import { useApp } from '@/context/AppContext';
import { partnerLabel } from '@/lib/partner';
import { formatMomentDate, formatMomentDateLong, momentSections, type MomentSection } from '@/lib/moments';
import { growFollowUpLabel } from '@/lib/growCheckBack';
import { radius } from '@/constants/tokens';

/**
 * One night, in full: both partners' three answers side by side, with any
 * voice notes playable inline.
 *
 * Nothing is fetched here — the entry already lives in `AppContext`, and its
 * partner half is only present at all if the reveal gate opened for that date.
 * That's why this screen needs no permission checks of its own.
 */

function Answer({
  name,
  text,
  voice,
  color,
}: {
  name: string;
  text: string;
  voice: string | null;
  color: string;
}) {
  if (!text && !voice) return null;
  return (
    <View style={styles.answer}>
      <Text style={styles.answerName}>{name}</Text>
      {text ? <Text style={styles.answerText}>{text}</Text> : null}
      {voice ? (
        <View style={styles.answerVoice}>
          <VoiceNotePlayer source={voice} color={color} compact />
        </View>
      ) : null}
    </View>
  );
}

function Section({
  section,
  myName,
  partnerName,
}: {
  section: MomentSection;
  myName: string;
  partnerName: string;
}) {
  const empty = !section.mine && !section.theirs && !section.myVoice && !section.theirVoice;
  if (empty) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
        <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
      </View>
      <View style={styles.sectionBody}>
        <Answer name={myName} text={section.mine} voice={section.myVoice} color={section.color} />
        <Answer name={partnerName} text={section.theirs} voice={section.theirVoice} color={section.color} />
      </View>
    </View>
  );
}

export default function MomentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { entries, couple, user } = useApp();

  const entry = entries.find((e) => e.date === date) ?? null;
  const myName = user?.name || 'You';
  const partnerName = partnerLabel(couple, 'Partner');

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 32 + (Platform.OS === 'web' ? 34 : 0);

  if (!entry) {
    return (
      <LinearGradient colors={['#0A0817', '#221D40']} style={styles.container}>
        <StarField />
        <View style={styles.missing}>
          <Ionicons name="moon-outline" size={26} color="#C0B8D4" />
          <Text style={styles.missingText}>That night isn't here anymore</Text>
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={18} color="#C0B8D4" />
            <Text style={styles.backText}>Back to Moments</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0A0817', '#141127', '#23203D', '#141127', '#0A0817']}
      locations={[0, 0.3, 0.55, 0.8, 1]}
      style={styles.container}
    >
      <StarField />

      <Pressable style={[styles.closeButton, { top: topPad + 12 }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#C0B8D4" />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 62, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{formatMomentDate(entry.date)}</Text>
          <Text style={styles.subtitle}>{formatMomentDateLong(entry.date)}</Text>
        </View>

        {momentSections(entry).map((section) => (
          <Section
            key={section.key}
            section={section}
            myName={myName}
            partnerName={partnerName}
          />
        ))}

        {/* The check-back reply, kept beside the Grow note it belongs to */}
        {(entry.growFollowUp || entry.partnerGrowFollowUp) && (
          <View style={styles.followUp}>
            <Ionicons name="leaf-outline" size={14} color="#A8D8A8" />
            <Text style={styles.followUpText}>
              {entry.growFollowUp
                ? `You checked back the next day: ${growFollowUpLabel(entry.growFollowUp)}.`
                : `${partnerName} checked back the next day: ${growFollowUpLabel(entry.partnerGrowFollowUp!)}.`}
            </Text>
          </View>
        )}

        {(entry.myReaction || entry.partnerReaction) && (
          <View style={styles.reactions}>
            {entry.myReaction ? (
              <Text style={styles.reactionText}>{myName} felt {entry.myReaction.toLowerCase()}</Text>
            ) : null}
            {entry.partnerReaction ? (
              <Text style={styles.reactionText}>
                {partnerName} felt {entry.partnerReaction.toLowerCase()}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },
  closeButton: {
    position: 'absolute',
    left: 22,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: '#1A1730',
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: { marginBottom: 28, gap: 4 },
  title: { fontSize: 28, fontFamily: 'Fraunces_600SemiBold', color: '#F5F2FB' },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#948BAC' },

  section: { marginBottom: 26, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionDot: { width: 7, height: 7, borderRadius: 3.5 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionBody: { gap: 10 },

  answer: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    gap: 7,
  },
  answerName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#948BAC',
    letterSpacing: 0.3,
  },
  answerText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#DCD1EF',
    lineHeight: 22,
  },
  answerVoice: { marginTop: 2 },

  followUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(168,216,168,0.16)',
    backgroundColor: 'rgba(168,216,168,0.05)',
  },
  followUpText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 19,
  },

  reactions: { gap: 4, alignItems: 'center', marginTop: 4 },
  reactionText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#2E2A4C' },

  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  missingText: { fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#C0B8D4' },
});
