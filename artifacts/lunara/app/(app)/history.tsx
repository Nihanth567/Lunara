import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { useApp } from '@/context/AppContext';
import { DailyEntry } from '@/context/AppContext';

type FilterType = 'all' | 'grateful' | 'cute' | 'grow';

const FILTERS: { key: FilterType; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '#F8F5FF' },
  { key: 'grateful', label: 'Grateful', color: '#FF9A8B' },
  { key: 'cute', label: 'Cute', color: '#C3B1E1' },
  { key: 'grow', label: 'Grow', color: '#A8D8A8' },
];

function formatEntryDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entryDay = new Date(date);
  entryDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - entryDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function EntryCard({ entry, filter }: { entry: DailyEntry; filter: FilterType }) {
  const [expanded, setExpanded] = useState(false);

  const showGrateful = filter === 'all' || filter === 'grateful';
  const showCute = filter === 'all' || filter === 'cute';
  const showGrow = filter === 'all' || filter === 'grow';

  if (!entry.revealed && entry.date !== new Date().toISOString().split('T')[0]) {
    return null;
  }

  return (
    <Pressable
      style={styles.entryCard}
      onPress={() => setExpanded((e) => !e)}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryDateRow}>
          <Text style={styles.entryDate}>{formatEntryDate(entry.date)}</Text>
          {entry.date === new Date().toISOString().split('T')[0] && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#7A6D98"
        />
      </View>

      {/* Preview (collapsed) */}
      {!expanded && (
        <View style={styles.previewRow}>
          {showGrateful && entry.grateful ? (
            <View style={[styles.previewDot, { backgroundColor: '#FF9A8B' }]} />
          ) : null}
          {showCute && entry.cute ? (
            <View style={[styles.previewDot, { backgroundColor: '#C3B1E1' }]} />
          ) : null}
          {showGrow && entry.grow ? (
            <View style={[styles.previewDot, { backgroundColor: '#A8D8A8' }]} />
          ) : null}
          <Text style={styles.previewText} numberOfLines={1}>
            {filter === 'grateful' && entry.grateful
              ? entry.grateful
              : filter === 'cute' && entry.cute
              ? entry.cute
              : filter === 'grow' && entry.grow
              ? entry.grow
              : entry.grateful || entry.cute || entry.grow || ''}
          </Text>
        </View>
      )}

      {/* Expanded content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {showGrateful && entry.grateful ? (
            <View style={styles.entrySection}>
              <View style={styles.entrySectionHeader}>
                <View style={[styles.entrySectionDot, { backgroundColor: '#FF9A8B' }]} />
                <Text style={[styles.entrySectionLabel, { color: '#FF9A8B' }]}>Grateful</Text>
                <Text style={styles.entrySectionMine}>You</Text>
              </View>
              <Text style={styles.entrySectionText}>{entry.grateful}</Text>
              {entry.partnerGrateful && (
                <>
                  <View style={styles.entrySectionHeader}>
                    <View style={[styles.entrySectionDot, { backgroundColor: '#FF9A8B' }]} />
                    <Text style={[styles.entrySectionLabel, { color: '#FF9A8B' }]}>Grateful</Text>
                    <Text style={styles.entrySectionMine}>Partner</Text>
                  </View>
                  <Text style={styles.entrySectionText}>{entry.partnerGrateful}</Text>
                </>
              )}
            </View>
          ) : null}

          {showCute && entry.cute ? (
            <View style={styles.entrySection}>
              <View style={styles.entrySectionHeader}>
                <View style={[styles.entrySectionDot, { backgroundColor: '#C3B1E1' }]} />
                <Text style={[styles.entrySectionLabel, { color: '#C3B1E1' }]}>Cute</Text>
                <Text style={styles.entrySectionMine}>You</Text>
              </View>
              <Text style={styles.entrySectionText}>{entry.cute}</Text>
              {entry.partnerCute && (
                <>
                  <View style={styles.entrySectionHeader}>
                    <View style={[styles.entrySectionDot, { backgroundColor: '#C3B1E1' }]} />
                    <Text style={[styles.entrySectionLabel, { color: '#C3B1E1' }]}>Cute</Text>
                    <Text style={styles.entrySectionMine}>Partner</Text>
                  </View>
                  <Text style={styles.entrySectionText}>{entry.partnerCute}</Text>
                </>
              )}
            </View>
          ) : null}

          {showGrow && entry.grow ? (
            <View style={styles.entrySection}>
              <View style={styles.entrySectionHeader}>
                <View style={[styles.entrySectionDot, { backgroundColor: '#A8D8A8' }]} />
                <Text style={[styles.entrySectionLabel, { color: '#A8D8A8' }]}>Grow</Text>
                <Text style={styles.entrySectionMine}>You</Text>
              </View>
              <Text style={styles.entrySectionText}>{entry.grow}</Text>
              {entry.partnerGrow && (
                <>
                  <View style={styles.entrySectionHeader}>
                    <View style={[styles.entrySectionDot, { backgroundColor: '#A8D8A8' }]} />
                    <Text style={[styles.entrySectionLabel, { color: '#A8D8A8' }]}>Grow</Text>
                    <Text style={styles.entrySectionMine}>Partner</Text>
                  </View>
                  <Text style={styles.entrySectionText}>{entry.partnerGrow}</Text>
                </>
              )}
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { entries, couple } = useApp();
  const [filter, setFilter] = useState<FilterType>('all');

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  // Sort entries newest first, only revealed ones
  const visibleEntries = [...entries]
    .filter((e) => e.revealed || e.submitted)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <LinearGradient
      colors={['#0F0C29', '#1A1635', '#24243E', '#1A1635', '#0F0C29']}
      locations={[0, 0.3, 0.55, 0.8, 1]}
      style={styles.container}
    >
      <StarField />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Moments</Text>
          <Text style={styles.subtitle}>
            {visibleEntries.length > 0
              ? `${visibleEntries.length} nights of gratitude`
              : 'Your history will appear here'}
          </Text>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filtersScroll}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[
                styles.filterPill,
                filter === f.key && styles.filterPillActive,
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f.key && { color: f.color, fontFamily: 'Inter_600SemiBold' },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Entries */}
        {visibleEntries.length > 0 ? (
          <View style={styles.entries}>
            {visibleEntries.map((entry, i) => (
              <Animated.View
                key={entry.date}
              >
                <EntryCard entry={entry} filter={filter} />
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
             <Ionicons name="moon-outline" size={36} color="rgba(195,177,225,0.4)" />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Complete your first ritual tonight and{'\n'}your moments will appear here
            </Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },
  header: { marginBottom: 20, gap: 4 },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },
  filtersScroll: { marginBottom: 20 },
  filters: { gap: 8, paddingRight: 22 },
  filterPill: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flex: 1,
    alignItems: 'center',
  },
  filterPillActive: { borderBottomColor: '#FF9A8B' },
  filterText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
  },
  entries: { gap: 12 },
  entryCard: {
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 0,
    padding: 16,
    gap: 10,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryDate: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
  },
  todayBadge: {
    backgroundColor: 'rgba(255,154,139,0.15)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.3)',
  },
  todayBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#FF9A8B',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
  },
  expandedContent: { gap: 16, paddingTop: 4 },
  entrySection: { gap: 4 },
  entrySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  entrySectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  entrySectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entrySectionMine: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    marginLeft: 'auto' as any,
  },
  entrySectionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#D4C8F0',
    lineHeight: 21,
    paddingLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    textAlign: 'center',
    lineHeight: 21,
  },
});
