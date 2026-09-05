import { radius } from '@/constants/tokens';
import React, { useMemo, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  DATE_IDEAS,
  DATE_THEMES,
  PREVIEW_DATE_IDEAS,
  type DateIdea,
  type DateTheme,
} from '@/lib/growth';

interface Props {
  isPro: boolean;
  onUnlock: () => void;
}

const THEME_ICON: Record<DateTheme, keyof typeof Ionicons.glyphMap> = {
  Cozy: 'bonfire-outline',
  Outdoor: 'trail-sign-outline',
  Conversational: 'chatbubbles-outline',
};

function IdeaCard({
  idea,
  width,
  style,
}: {
  idea: DateIdea;
  width?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.ideaCard, width ? { width } : null, style]}>
      <View style={styles.ideaHeader}>
        <Ionicons name={THEME_ICON[idea.theme]} size={15} color="#C3B1E1" />
        <Text style={styles.ideaTheme}>{idea.theme}</Text>
        <Text style={styles.ideaDuration}>{idea.duration}</Text>
      </View>
      <Text style={styles.ideaTitle}>{idea.title}</Text>
      <Text style={styles.ideaDesc}>{idea.description}</Text>
    </View>
  );
}

/** "Growth & Date Night Ideas" — teaser for free users, full deck for Pro. */
export function DateNightSection({ isPro, onUnlock }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [theme, setTheme] = useState<DateTheme>('Cozy');
  const [page, setPage] = useState(0);

  // Card width inside the 22px screen padding used by the Us tab.
  const cardWidth = screenWidth - 44;

  const deck = useMemo(() => DATE_IDEAS.filter((d) => d.theme === theme), [theme]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12));
    if (next !== page) setPage(next);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Growth & Date Night Ideas</Text>

      {!isPro && (
        <View style={styles.previewWrap}>
          {PREVIEW_DATE_IDEAS.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
          <View style={styles.lockRow}>
            <Ionicons name="lock-closed" size={13} color="#948BAC" />
            <Text style={styles.lockText}>
              {DATE_IDEAS.length} ideas across Cozy, Outdoor & Conversational themes
            </Text>
          </View>
          <Pressable
            style={styles.unlockBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onUnlock();
            }}
          >
            <Ionicons name="sparkles" size={16} color="#0A0817" />
            <Text style={styles.unlockText}>Unlock Full Date Night Playbook with Lunara Pro</Text>
          </Pressable>
        </View>
      )}

      {isPro && (
        <View>
          <View style={styles.themeRow}>
            {DATE_THEMES.map((t) => {
              const active = t === theme;
              return (
                <Pressable
                  key={t}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTheme(t);
                    setPage(0);
                  }}
                >
                  <Ionicons
                    name={THEME_ICON[t]}
                    size={13}
                    color={active ? '#F5F2FB' : '#C0B8D4'}
                  />
                  <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            snapToInterval={cardWidth + 12}
            disableIntervalMomentum
            decelerationRate="fast"
            key={theme}
          >
            {deck.map((idea, i) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                width={cardWidth}
                style={i < deck.length - 1 ? { marginRight: 12 } : undefined}
              />
            ))}
          </ScrollView>

          <View style={styles.dots}>
            {deck.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24, gap: 12 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#948BAC',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  previewWrap: { gap: 12 },

  ideaCard: {
    backgroundColor: '#1A1730',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    gap: 8,
  },
  ideaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ideaTheme: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#C3B1E1',
    letterSpacing: 0.3,
    flex: 1,
  },
  ideaDuration: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },
  ideaTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F5F2FB',
  },
  ideaDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#C0B8D4',
    lineHeight: 19,
  },

  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  lockText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#948BAC' },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9A8B',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.35)',
  },
  unlockText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0A0817',
    textAlign: 'center',
    flexShrink: 1,
  },

  themeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  themeChipActive: {
    borderColor: 'rgba(195,177,225,0.4)',
    backgroundColor: 'rgba(195,177,225,0.16)',
  },
  themeChipText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#C0B8D4' },
  themeChipTextActive: { color: '#F5F2FB' },

  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 12 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: { backgroundColor: '#C3B1E1' },
});
