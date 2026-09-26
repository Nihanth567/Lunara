import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { SpringPressable } from '@/components/SpringPressable';
import { EmptyState } from '@/components/EmptyState';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { useApp, type DailyEntry } from '@/context/AppContext';
import { isPro, freeHistoryCutoffDate, FREE_HISTORY_DAYS } from '@/lib/entitlements';
import { formatMomentDate, momentIsComplete, momentVoiceCount } from '@/lib/moments';
import { weekRecap } from '@/lib/weeklyRecap';
import { pressScale, radius } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';

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
    <SpringPressable
      style={styles.row}
      onPress={onPress}
      scaleTo={pressScale.card}
      accessibilityLabel={`${formatMomentDate(entry.date)}. ${preview}`}
      accessibilityHint="Opens this night"
    >
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowDate}>{formatMomentDate(entry.date)}</Text>
          <View style={styles.rowDots}>
            {entry.grateful ? <View style={[styles.dot, { backgroundColor: palette.accent.glow }]} /> : null}
            {entry.cute ? <View style={[styles.dot, { backgroundColor: palette.content[1] }]} /> : null}
            {entry.grow ? <View style={[styles.dot, { backgroundColor: palette.accent.success }]} /> : null}
          </View>
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
        {voiceCount > 0 && (
          <View style={styles.rowVoice}>
            <Ionicons name="mic" size={11} color={palette.content[2]} />
            <Text style={styles.rowVoiceText}>
              {voiceCount} voice {voiceCount === 1 ? 'note' : 'notes'}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.ink[4]} />
    </SpringPressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries, couple, ritualDate } = useApp();
  const weekNights = weekRecap(entries, ritualDate).nights;

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
    router.push(`/moment/${date}`);
  };

  return (
    <LinearGradient
      colors={[palette.ink[0], palette.ink[1], palette.ink[3], palette.ink[1], palette.ink[0]]}
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

        {/* The one thing worth opening first: the week, read back. Only once
            there is a week to read. */}
        {weekNights > 0 && (
          <SpringPressable
            style={styles.weekCard}
            scaleTo={pressScale.card}
            onPress={() => router.push('/weekly-recap' as never)}
          >
            <View style={styles.weekIcon}>
              <Ionicons name="sparkles" size={18} color={palette.accent.glow} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.weekTitle}>Your week</Text>
              <Text style={styles.weekSub}>
                {weekNights} {weekNights === 1 ? 'night' : 'nights'} together
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.content[2]} />
          </SpringPressable>
        )}

        {visible.length > 0 ? (
          <View style={styles.list}>
            {visible.map((entry) => (
              <MomentRow key={entry.date} entry={entry} onPress={() => open(entry.date)} />
            ))}
          </View>
        ) : lockedCount === 0 ? (
          <EmptyState
            art={<CoupleCompanion state="nesting" size="md" />}
            title="Your nights will live here"
            body="Finish tonight together and it's kept here, for both of you."
            action={{ label: 'Start tonight', onPress: () => router.navigate('/(app)/' as never) }}
          />
        ) : null}

        {lockedCount > 0 && (
          <SpringPressable
            style={styles.lockedBanner}
            scaleTo={pressScale.card}
            onPress={() => router.push('/(modals)/paywall')}
          >
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed" size={16} color={palette.accent.glow} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.lockedTitle}>
                {lockedCount} earlier {lockedCount === 1 ? 'moment is' : 'moments are'} waiting
              </Text>
              {/*
                This banner is a backstop, not a free tier. The front gate means
                nobody without an entitlement reaches this screen, so if it ever
                renders, something upstream is wrong and the honest thing to say
                is that the archive is incomplete — not to advertise a free plan
                Lunara no longer has.
              */}
              <Text style={styles.lockedBody}>
                Showing the last {FREE_HISTORY_DAYS} days — subscribe to see every night
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={palette.content[2]} />
          </SpringPressable>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },
  header: { marginBottom: 22, gap: 4 },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', color: palette.content[0] },
  subtitle: { fontSize: 14, fontFamily: 'Nunito_400Regular', color: palette.content[2] },

  list: { gap: 10 },
  weekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    marginBottom: 22,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: palette.ink[2],
    borderWidth: 1,
    borderColor: tint.glow(0.28),
  },
  weekIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint.glow(0.12),
  },
  weekTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: palette.content[0] },
  weekSub: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: palette.content[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.cream(0.08),
    padding: 16,
  },
  rowMain: { flex: 1, gap: 5 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowDate: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: palette.content[0] },
  rowDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  rowPreview: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[1] },
  rowVoice: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowVoiceText: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2] },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 107,0.2)',
    padding: 16,
  },
  lockedIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 184, 107,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedTitle: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: palette.content[0] },
  lockedBody: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[1] },
});
