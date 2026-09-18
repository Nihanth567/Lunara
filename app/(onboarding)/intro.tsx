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
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { gradients, palette, tint } from '@/constants/colors';
import { radius, space, hitSlopFor } from '@/constants/tokens';
import { type as text } from '@/constants/typography';

/**
 * The intro — three panels, swipeable, skippable.
 *
 * ─── Three, not four ─────────────────────────────────────────────────────────
 *
 * It was four: the invite code, the two-colour list mechanic, a placeholder
 * "designed to make you smile" panel, and a summary. Two of those were about
 * the shared *list*, which is the half of the product that explains itself the
 * moment you see it, and one was a panel about the app being nice — the most
 * skippable screen it is possible to write.
 *
 * What is left is the three things a person cannot work out for themselves:
 * there is a creature and it belongs to both of you; it only lights up when
 * *both* of you show up; and the thing you show up to is three small questions.
 * In that order, because the fox is the reason to care about the other two.
 *
 * ─── Shown before sign-in, on purpose ────────────────────────────────────────
 *
 * Asking someone to authenticate before they know what the app is is the most
 * reliable way to lose them on first launch. Three panels costs nothing and
 * Skip is always on screen.
 *
 * Every panel is art-first and text-light: one illustration, one line of title,
 * two lines of body at most. If a panel needs a paragraph, the panel is wrong.
 */

// ─── Panel illustrations ─────────────────────────────────────────────────────

/**
 * The fox itself, at hero size, in its `nesting` state — settled, awake, and
 * waiting for something that hasn't happened yet, which is exactly what is true
 * of a couple who has not signed up. Using the real component rather than a
 * drawing of one means the first fox someone ever sees is the same animal, at
 * the same size, that will be at the top of their home screen tonight.
 */
function FoxArt() {
  return <CoupleCompanion state="nesting" streak={0} size="hero" />;
}

/**
 * The mutual-reveal mechanic, drawn.
 *
 * Two sealed cards and a lock between them. This is the one rule that makes the
 * product a couples app rather than a shared notes file, and a sentence
 * describing it does not land the way two closed envelopes do.
 */
function BothOfYouArt() {
  return (
    <View style={styles.bothRow}>
      <View style={[styles.sealedCard, { borderColor: tint.heart(0.35) }]}>
        <Ionicons name="lock-closed" size={18} color={palette.partners.a} />
        <Text style={[styles.sealedName, { color: palette.partners.a }]}>You</Text>
      </View>
      <View style={styles.bothLink}>
        <Ionicons name="heart" size={16} color={palette.accent.heart} />
      </View>
      <View style={[styles.sealedCard, { borderColor: tint.moon(0.35) }]}>
        <Ionicons name="lock-closed" size={18} color={palette.partners.b} />
        <Text style={[styles.sealedName, { color: palette.partners.b }]}>Them</Text>
      </View>
    </View>
  );
}

/** The three prompts, as the three cards they actually are. */
function RitualArt() {
  const rows = [
    { label: 'Grateful', color: palette.accent.heart, icon: 'heart-outline' as const },
    { label: 'Cute', color: palette.accent.moon, icon: 'happy-outline' as const },
    { label: 'Grow', color: palette.accent.success, icon: 'leaf-outline' as const },
  ];
  return (
    <View style={styles.artList}>
      {rows.map((row) => (
        <View key={row.label} style={styles.artRow}>
          <Ionicons name={row.icon} size={18} color={row.color} />
          <Text style={[styles.artRowText, { color: row.color }]}>{row.label}</Text>
          <View style={[styles.artDot, { backgroundColor: row.color }]} />
        </View>
      ))}
    </View>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────────────

const PANELS = [
  {
    key: 'fox',
    art: FoxArt,
    title: 'Meet your fox',
    body: 'Not yours. Not theirs. Yours together — and it brightens on the nights you both turn up.',
  },
  {
    key: 'both',
    art: BothOfYouArt,
    title: 'It takes both of you',
    body: 'What you write stays sealed until your person writes theirs. Then it opens at the same time, for both of you.',
  },
  {
    key: 'ritual',
    art: RitualArt,
    title: 'Three small questions',
    body: 'Something grateful, something cute, something to grow. Two minutes, once a night.',
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
    // Set the page as well as scrolling to it. `onMomentumScrollEnd` fires for
    // a finger, but not reliably for a programmatic `scrollTo` — so driving the
    // pager with the button alone left the dots stuck on panel one while the
    // content moved underneath them.
    const next = page + 1;
    setPage(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
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
  panel: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xxl },
  artWrap: { minHeight: 230, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: space.md, marginTop: space.xxl },
  panelTitle: { ...text.hero, color: palette.content[0], textAlign: 'center' },
  panelBody: {
    ...text.body,
    color: palette.content[1],
    textAlign: 'center',
    lineHeight: 25,
  },

  // ── "It takes both of you" ────────────────────────────────────────────────
  bothRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sealedCard: {
    width: 104,
    height: 116,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: palette.ink[2],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  sealedName: { ...text.caption },
  bothLink: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: tint.heart(0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── The three prompts ─────────────────────────────────────────────────────
  artList: { gap: space.sm, width: '100%', maxWidth: 260 },
  artRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: palette.ink[4],
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
  },
  artRowText: { ...text.label, flex: 1 },
  artDot: { width: 8, height: 8, borderRadius: radius.full },

  footer: { paddingHorizontal: space.xxl, gap: space.xl, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: space.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: palette.ink[4],
  },
  dotActive: { backgroundColor: palette.accent.glow, width: 22 },
});
