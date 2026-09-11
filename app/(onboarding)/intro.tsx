import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { LunaraButton } from '@/components/LunaraButton';
import { gradients, palette } from '@/constants/colors';
import { radius, space, hitSlopFor } from '@/constants/tokens';
import { type as text } from '@/constants/typography';

/**
 * The intro — four panels, swipeable, skippable.
 *
 * Deliberately shown *before* the sign-in screen. Asking someone to
 * authenticate before they know what the app is is the most reliable way to
 * lose them on the first launch; four screens of what this is costs nothing and
 * the Skip button is always there.
 *
 * Each panel carries its own small piece of interface rather than an icon in a
 * circle. Panel two in particular has to *show* the two-colour mechanic — it is
 * the whole reason this is a couples app rather than a shared notes file, and a
 * paragraph describing it does not land the way a drawn checkbox does.
 */

// ─── Panel illustrations ─────────────────────────────────────────────────────

/** The six-letter code, drawn as the boxes it is actually typed into. */
function CodeArt() {
  return (
    <View style={styles.codeRow}>
      {['K', 'M', '7', 'R', 'Q', '4'].map((char, i) => (
        <View key={i} style={styles.codeBox}>
          <Text style={styles.codeChar}>{char}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Two rows: one either of you can finish, one neither of you can finish alone.
 * The second row is drawn mid-state — ticked on one side only — because the
 * waiting is the part that needs explaining.
 */
function TwoColourArt() {
  return (
    <View style={styles.artList}>
      <View style={styles.artRow}>
        <View style={[styles.artCheck, { backgroundColor: palette.partners.a, borderColor: palette.partners.a }]}>
          <Ionicons name="checkmark" size={13} color={palette.ink[0]} />
        </View>
        <Text style={[styles.artRowText, styles.artRowTextDone]}>Pick up the parcel</Text>
      </View>

      <View style={styles.artRow}>
        <View style={[styles.artCheck, { borderColor: palette.ink[4] }]} />
        <Text style={styles.artRowText}>Decide on March</Text>
        <View style={styles.artBoth}>
          <View style={[styles.artDot, { backgroundColor: palette.ink[4] }]} />
          <View style={[styles.artDot, { backgroundColor: palette.partners.b }]} />
        </View>
      </View>

      <Text style={styles.artCaption}>
        <Text style={{ color: palette.partners.b }}>●</Text> them ·{' '}
        <Text style={{ color: palette.partners.a }}>●</Text> you
      </Text>
    </View>
  );
}

/**
 * Placeholder for the illustration that is coming.
 *
 * Drawn as a real shape rather than left blank so the panel's rhythm is already
 * correct when the artwork lands — swapping it in is a one-component change,
 * not a re-layout.
 */
function CharacterArt() {
  return (
    <View style={styles.characterSlot}>
      <View style={styles.characterGlow} />
      <Ionicons name="heart" size={40} color={palette.accent.blush} />
    </View>
  );
}

/** The two halves of the product, side by side. */
function TogetherArt() {
  return (
    <View style={styles.togetherRow}>
      <View style={styles.togetherCard}>
        <Ionicons name="checkmark-circle" size={22} color={palette.accent.rose} />
        <Text style={styles.togetherLabel}>The everyday</Text>
      </View>
      <View style={styles.togetherCard}>
        <Ionicons name="moon" size={22} color={palette.accent.lilac} />
        <Text style={styles.togetherLabel}>The every night</Text>
      </View>
    </View>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────────────

const PANELS = [
  {
    key: 'code',
    art: CodeArt,
    title: 'One code, and they’re in',
    body: 'Share your six-letter code and your partner joins in seconds. Nothing to configure, no invites to chase — just your list, ready to go.',
  },
  {
    key: 'two',
    art: TwoColourArt,
    title: 'Built for two, not just one',
    body: 'Each of you gets your own colour. Check things off solo, or wait for each other — some things are only done when you both tick them. You’ll see who did what as it happens.',
  },
  {
    key: 'character',
    art: CharacterArt,
    title: 'Designed to make you smile',
    body: 'Soft colours, gentle motion, and a little weight behind every tick. A couples app you enjoy opening is one you’ll actually keep open.',
  },
  {
    key: 'together',
    art: TogetherArt,
    title: 'The big moments are easy to remember',
    body: 'Lunara helps you handle everything else. A shared list for the day, and three quiet questions at night — together.',
  },
] as const;

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const isLast = page === PANELS.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) {
      setPage(next);
      Haptics.selectionAsync();
    }
  };

  const advance = () => {
    if (isLast) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/(onboarding)/auth');
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <LinearGradient
      colors={gradients.screen}
      locations={gradients.screenLocations}
      style={styles.container}
    >
      <StarField />

      <View style={[styles.skipRow, { paddingTop: insets.top + space.md }]}>
        <Pressable
          onPress={() => router.push('/(onboarding)/auth')}
          hitSlop={hitSlopFor(32)}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {PANELS.map((panel) => {
          const Art = panel.art;
          return (
            <View key={panel.key} style={[styles.panel, { width }]}>
              <View style={styles.artWrap}>
                <Art />
              </View>
              <View style={styles.copy}>
                <Text style={styles.panelTitle}>{panel.title}</Text>
                <Text style={styles.panelBody}>{panel.body}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.dots}>
          {PANELS.map((panel, i) => (
            <View
              key={panel.key}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
        <LunaraButton
          title={isLast ? 'Get started' : 'Next'}
          onPress={advance}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  skipRow: { alignItems: 'flex-end', paddingHorizontal: space.xl },
  skipBtn: { paddingVertical: space.sm, paddingHorizontal: space.sm },
  skipText: { ...text.callout, color: palette.content[2] },

  pager: { flex: 1 },
  panel: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  artWrap: { minHeight: 190, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: space.md, marginTop: space.xxxl },
  panelTitle: { ...text.title, color: palette.content[0], textAlign: 'center' },
  panelBody: {
    ...text.body,
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 25,
  },

  // ── Code panel ──
  codeRow: { flexDirection: 'row', gap: space.sm },
  codeBox: {
    width: 42,
    height: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: palette.ink[2],
    borderWidth: 1,
    borderColor: palette.ink[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: { ...text.heading, color: palette.content[0] },

  // ── Two-colour panel ──
  artList: { gap: space.sm, width: '100%', maxWidth: 300 },
  artRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(248, 241, 246, 0.08)',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  artCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderCurve: 'continuous',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artRowText: { ...text.callout, color: palette.content[0], flex: 1 },
  artRowTextDone: { textDecorationLine: 'line-through', color: palette.content[2] },
  artBoth: { flexDirection: 'row', gap: space.xs },
  artDot: { width: 7, height: 7, borderRadius: radius.full },
  artCaption: {
    ...text.caption,
    color: palette.content[2],
    textAlign: 'center',
    marginTop: space.xs,
  },

  // ── Character panel ──
  characterSlot: {
    width: 132,
    height: 132,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink[2],
    borderWidth: 1,
    borderColor: palette.ink[4],
  },
  characterGlow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: radius.full,
    backgroundColor: 'rgba(232, 160, 180, 0.10)',
  },

  // ── Together panel ──
  togetherRow: { flexDirection: 'row', gap: space.md },
  togetherCard: {
    width: 128,
    gap: space.sm,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(248, 241, 246, 0.08)',
    padding: space.lg,
  },
  togetherLabel: { ...text.callout, color: palette.content[1] },

  footer: { paddingHorizontal: 32, gap: space.xl, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: space.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: palette.ink[4],
  },
  dotActive: { backgroundColor: palette.accent.rose, width: 20 },
});
