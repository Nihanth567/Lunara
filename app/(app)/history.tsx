import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { useApp, type DailyEntry } from '@/context/AppContext';
import { isPro, freeHistoryCutoffDate, FREE_HISTORY_DAYS } from '@/lib/entitlements';
import { formatMomentDate, momentIsComplete, momentVoiceCount } from '@/lib/moments';
import { radius } from '@/constants/tokens';

/**
 * Moments — a plain chronological list of the nights a couple completed
 * together. Tapping a night opens it in full.
 *
 * Deliberately no filters and no search: the value here is scrolling back
 * through your own history, and every control added to that is a control
 * between someone and the thing they came to read.
 */

function MomentRow({ entry, onPress }: { entry: DailyEntry; onPress: () => void }) {
  const voiceCount = momentVoiceCount(entry);
  // The first line of the Grateful note is the warmest preview available.
  const preview = entry.grateful || entry.cute || entry.grow || '';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowDate}>{formatMomentDate(entry.date)}</Text>
          <View style={styles.rowDots}>
            {entry.grateful ? <View style={[styles.dot, { backgroundColor: '#E8A0B4' }]} /> : null}
            {entry.cute ? <View style={[styles.dot, { backgroundColor: '#CBB9C9' }]} /> : null}
            {entry.grow ? <View style={[styles.dot, { backgroundColor: '#9BC9A8' }]} /> : null}
          </View>
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
        {voiceCount > 0 && (
          <View style={styles.rowVoice}>
            <Ionicons name="mic" size={11} color="#A492A6" />
            <Text style={styles.rowVoiceText}>
              {voiceCount} voice {voiceCount === 1 ? 'note' : 'notes'}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#42304A" />
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries, couple } = useApp();

  const proUser = isPro(couple);
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  // Only nights both partners finished belong here — an unfinished night has
  // nothing shared to show, and the reveal gate wouldn't return it anyway.
  const allMoments = entries
    .filter(momentIsComplete)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Free accounts keep a trailing window; the rest are counted so the banner
  // can say how much is waiting.
  const cutoff = freeHistoryCutoffDate();
  const visible = proUser ? allMoments : allMoments.filter((e) => e.date >= cutoff);
  const lockedCount = allMoments.length - visible.length;

  const open = (date: string) => {
    Haptics.selectionAsync();
    router.push(`/moment/${date}`);
  };

  return (
    <LinearGradient
      colors={['#150F19', '#1B1421', '#312338', '#1B1421', '#150F19']}
      locations={[0, 0.3, 0.55, 0.8, 1]}
      style={styles.container}
    >
      <StarField />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Moments</Text>
          <Text style={styles.subtitle}>
            {visible.length > 0
              ? `${visible.length} ${visible.length === 1 ? 'night' : 'nights'} you've kept together`
              : 'The nights you share will gather here, gently'}
          </Text>
        </View>

        {visible.length > 0 ? (
          <View style={styles.list}>
            {visible.map((entry) => (
              <MomentRow key={entry.date} entry={entry} onPress={() => open(entry.date)} />
            ))}
          </View>
        ) : lockedCount === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="moon-outline" size={36} color="rgba(248, 241, 246,0.4)" />
            <Text style={styles.emptyTitle}>Your story starts tonight</Text>
            <Text style={styles.emptyBody}>
              Share tonight's ritual with your partner, and this{'\n'}quiet little archive of your moments together begins
            </Text>
          </View>
        ) : null}

        {lockedCount > 0 && (
          <Pressable style={styles.lockedBanner} onPress={() => router.push('/(modals)/paywall')}>
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed" size={16} color="#E8A0B4" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.lockedTitle}>
                {lockedCount} earlier {lockedCount === 1 ? 'moment is' : 'moments are'} waiting
              </Text>
              <Text style={styles.lockedBody}>
                Free keeps your last {FREE_HISTORY_DAYS} days — Lunara Pro keeps all of them
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#A492A6" />
          </Pressable>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },
  header: { marginBottom: 22, gap: 4 },
  title: { fontSize: 28, fontFamily: 'Fraunces_600SemiBold', color: '#F8F1F6' },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#A492A6' },

  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#251B2B',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(248, 241, 246,0.08)',
    padding: 16,
  },
  rowMain: { flex: 1, gap: 5 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowDate: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F8F1F6' },
  rowDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  rowPreview: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#CBB9C9' },
  rowVoice: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowVoiceText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#A492A6' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 22, fontFamily: 'Fraunces_600SemiBold', color: '#F8F1F6',
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#A492A6',
    textAlign: 'center',
    lineHeight: 21,
  },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    backgroundColor: '#251B2B',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 180,0.2)',
    padding: 16,
  },
  lockedIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(232, 160, 180,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F8F1F6' },
  lockedBody: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#CBB9C9' },
});
