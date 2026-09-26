import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { VoiceNotePlayer } from '@/components/VoiceNotePlayer';
import { SpringPressable } from '@/components/SpringPressable';
import { EmptyState } from '@/components/EmptyState';
import { useApp } from '@/context/AppContext';
import { partnerLabel } from '@/lib/partner';
import { weekRecap, type RecapLine } from '@/lib/weeklyRecap';
import { fetchGrowGuidance, getGrowGuidance, type GrowSuggestion } from '@/lib/growGuidance';
import { gradients, palette, promptAccent } from '@/constants/colors';
import { hitSlopFor, pressScale, radius, space } from '@/constants/tokens';
import { type as text, tabularNumerals } from '@/constants/typography';

/**
 * "Your week" — four short lists, nothing else.
 *
 * What you were grateful for, what you found cute, what you want to grow, and
 * how to grow it. Only the couple's own words (plus a few suggestions drawn
 * from their Grow answers): no stats, no charts, no score. The data rules —
 * which nights count, and that tonight never leaks before the reveal — live in
 * `lib/weeklyRecap.ts`, where they are tested.
 *
 * Each list shows its newest four lines, with one "Show all" rather than a
 * wall of fourteen. The screen should take about twenty seconds to read.
 */

const PREVIEW_LINES = 4;

function Line({
  line,
  myName,
  partnerName,
  color,
}: {
  line: RecapLine;
  myName: string;
  partnerName: string;
  color: string;
}) {
  const mine = line.who === 'me';
  return (
    <View style={styles.line}>
      <Text style={[styles.lineName, { color: mine ? palette.partners.a : palette.partners.b }]}>
        {mine ? myName : partnerName}
      </Text>
      {line.text ? <Text style={styles.lineText}>{line.text}</Text> : null}
      {line.voice ? (
        <View style={styles.lineVoice}>
          <VoiceNotePlayer source={line.voice} durationMs={line.voiceDurationMs} color={color} compact />
        </View>
      ) : null}
    </View>
  );
}

function Section({
  title,
  icon,
  color,
  lines,
  myName,
  partnerName,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  lines: RecapLine[];
  myName: string;
  partnerName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (lines.length === 0) return null;
  const shown = expanded ? lines : lines.slice(0, PREVIEW_LINES);
  const hidden = lines.length - shown.length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </View>
      <View style={styles.card}>
        {shown.map((line) => (
          <Line
            key={`${line.date}-${line.who}`}
            line={line}
            myName={myName}
            partnerName={partnerName}
            color={color}
          />
        ))}
        {hidden > 0 && (
          <SpringPressable
            onPress={() => setExpanded(true)}
            hitSlop={8}
            feedback="highlight"
            style={styles.showAll}
          >
            <Text style={[styles.showAllText, { color }]}>Show all {lines.length}</Text>
          </SpringPressable>
        )}
      </View>
    </View>
  );
}

export default function WeeklyRecapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entries, couple, user, ritualDate } = useApp();

  const recap = weekRecap(entries, ritualDate);
  const myName = user?.name || 'You';
  const partnerName = partnerLabel(couple, 'Partner');

  // Suggestions from this week's Grow answers. The local templates render
  // straight away; the edge function (if configured) replaces them when it
  // answers, and falls back to the same templates if it doesn't — so this is
  // never a spinner.
  const growTexts = recap.grow.map((l) => l.text).filter(Boolean);
  const growKey = growTexts.join('\n');
  const [tips, setTips] = useState<GrowSuggestion[]>(() => getGrowGuidance(growTexts));
  useEffect(() => {
    let cancelled = false;
    const texts = growKey ? growKey.split('\n') : [];
    setTips(getGrowGuidance(texts));
    if (texts.length === 0) return;
    fetchGrowGuidance(texts)
      .then((result) => {
        if (!cancelled && result.suggestions.length > 0) setTips(result.suggestions.slice(0, 3));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [growKey]);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 32 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <LinearGradient colors={gradients.screen} locations={gradients.screenLocations} style={styles.container}>
      <StarField />

      <SpringPressable
        style={[styles.closeButton, { top: topPad + 12 }]}
        onPress={() => router.back()}
        scaleTo={pressScale.icon}
        hitSlop={hitSlopFor(40)}
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={palette.content[1]} />
      </SpringPressable>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 62, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your week</Text>
          <Text style={[styles.subtitle, tabularNumerals]}>
            {recap.nights === 0
              ? 'The last seven nights'
              : `${recap.nights} ${recap.nights === 1 ? 'night' : 'nights'} together`}
          </Text>
        </View>

        {recap.nights === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body="Finish a night together and it’ll be waiting here."
            action={{ label: 'Back to Moments', onPress: () => router.back() }}
          />
        ) : (
          <>
            <Section
              title="Grateful for"
              icon="heart"
              color={promptAccent.grateful}
              lines={recap.grateful}
              myName={myName}
              partnerName={partnerName}
            />
            <Section
              title="Found cute"
              icon="happy"
              color={promptAccent.cute}
              lines={recap.cute}
              myName={myName}
              partnerName={partnerName}
            />
            <Section
              title="Working on"
              icon="leaf"
              color={promptAccent.grow}
              lines={recap.grow}
              myName={myName}
              partnerName={partnerName}
            />

            {recap.grow.length > 0 && tips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles" size={18} color={palette.accent.glow} />
                  <Text style={[styles.sectionTitle, { color: palette.accent.glow }]}>How to grow</Text>
                </View>
                <View style={styles.card}>
                  {tips.map((tip) => (
                    <View key={tip.id} style={styles.tipRow}>
                      <View style={styles.tipDot} />
                      <Text style={styles.tipText}>{tip.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: space.xl },
  closeButton: {
    position: 'absolute',
    left: space.xl,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: palette.ink[2],
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: { marginBottom: space.xxl, gap: space.xs },
  title: { ...text.hero, color: palette.content[0] },
  subtitle: { ...text.callout, color: palette.content[2] },

  section: { marginBottom: space.xl, gap: space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTitle: { ...text.heading },
  card: {
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space.lg,
    gap: space.lg,
  },

  line: { gap: space.xs },
  lineName: { ...text.caption },
  lineText: { ...text.prose, color: palette.content[0] },
  lineVoice: { marginTop: space.xs },

  showAll: { alignSelf: 'flex-start', paddingVertical: space.xs },
  showAllText: { ...text.label, fontSize: 14 },

  tipRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: palette.accent.glow,
    marginTop: 9,
  },
  tipText: { ...text.body, color: palette.content[0], flex: 1 },

});
