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
            {entry.grateful ? <View style={[styles.dot, { backgroundColor: '#FF9A8B' }]} /> : null}
            {entry.cute ? <View style={[styles.dot, { backgroundColor: '#C3B1E1' }]} /> : null}
            {entry.grow ? <View style={[styles.dot, { backgroundColor: '#A8D8A8' }]} /> : null}
          </View>
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
        {voiceCount > 0 && (
          <View style={styles.rowVoice}>
            <Ionicons name="mic" size={11} color="#948BAC" />
            <Text style={styles.rowVoiceText}>
              {voiceCount} voice {voiceCount === 1 ? 'note' : 'notes'}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#2E2A4C" />
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
      colors={['#0A0817', '#141127', '#23203D', '#141127', '#0A0817']}
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
            <Ionicons name="moon-outline" size={36} color="rgba(195,177,225,0.4)" />
            <Text style={styles.emptyTitle}>Your story starts tonight</Text>
            <Text style={styles.emptyBody}>
              Share tonight's ritual with your partner, and this{'\n'}quiet little archive of your moments together begins
            </Text>
          </View>
        ) : null}

        {lockedCount > 0 && (
          <Pressable style={styles.lockedBanner} onPress={() => router.push('/(modals)/paywall')}>
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed" size={16} color="#FF9A8B" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.lockedTitle}>
                {lockedCount} earlier {lockedCount === 1 ? 'moment is' : 'moments are'} waiting
              </Text>
              <Text style={styles.lockedBody}>
                Free keeps your last {FREE_HISTORY_DAYS} days — Lunara Pro keeps all of them
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#948BAC" />
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
  title: { fontSize: 28, fontFamily: 'Fraunces_600SemiBold', color: '#F5F2FB' },
  subtitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#948BAC' },

  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  rowMain: { flex: 1, gap: 5 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowDate: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F5F2FB' },
  rowDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  rowPreview: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
  rowVoice: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowVoiceText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#948BAC' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 22, fontFamily: 'Fraunces_600SemiBold', color: '#F5F2FB',
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
    textAlign: 'center',
    lineHeight: 21,
  },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.2)',
    padding: 16,
  },
  lockedIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,154,139,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#F5F2FB' },
  lockedBody: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#C0B8D4' },
});
