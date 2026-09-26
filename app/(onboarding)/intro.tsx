import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  OnboardingFrame,
  OnboardingHeading,
  OnboardingPhoto,
  FUNNEL,
} from '@/components/OnboardingFrame';
import { ONBOARDING_PHOTOS } from '@/assets/images/onboarding';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { LunaraButton } from '@/components/LunaraButton';
import { SpringPressable } from '@/components/SpringPressable';
import { palette, tint } from '@/constants/colors';
import { duration, elevation, radius, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

/**
 * The magic — what a night feels like, shown rather than described.
 *
 * ─── What this replaced ──────────────────────────────────────────────────────
 *
 * Three swipeable panels that each *described* one rule. This plays the rules
 * as one short scene instead: the two of you apart with your answers sealed,
 * the fox lighting up when both are in, and the two of you together over one
 * phone as the night opens with a line and a voice note. A person who has
 * watched a night happen once understands the product faster than one who has
 * read three sentences about it.
 *
 * The first and last beats are photographs of a real-feeling couple, with the
 * product laid over them — the locks on their answers, the card they open —
 * so the picture is of the moment and the overlay is what Lunara adds to it.
 * The middle beat is the fox alone, because that is the part only this app has.
 *
 * ─── Motion ──────────────────────────────────────────────────────────────────
 *
 * The beats advance on their own, once, and stop on the last one — no loop, so
 * nothing keeps moving under someone reading. The dots jump to any beat. Under
 * Reduce Motion the cross-fades become cuts (Reanimated's default) and the fox
 * holds still, but the scene still plays; the words carry it.
 */

/** Long enough to take in a photograph and read its line. */
const BEAT_MS = 2600;

const BEATS = [
  { key: 'apart', caption: 'Each of you answers three small questions — privately.' },
  { key: 'both', caption: 'When you’ve both shared, your fox lights up.' },
  { key: 'open', caption: 'Then you open them together. Their words, or their voice.' },
] as const;

/** Beat one: the two of you apart, each answer sealed in your own colour. */
function ApartScene() {
  return (
    <OnboardingPhoto photo={ONBOARDING_PHOTOS.apart} style={styles.photo}>
      <View style={styles.locks} importantForAccessibility="no-hide-descendants">
        {(
          [
            { who: 'You', color: palette.partners.a },
            { who: 'Them', color: palette.partners.b },
          ] as const
        ).map((side) => (
          <View key={side.who} style={styles.lock}>
            <Ionicons name="lock-closed" size={13} color={side.color} />
            <Text style={[styles.lockText, { color: side.color }]}>{side.who}</Text>
          </View>
        ))}
      </View>
    </OnboardingPhoto>
  );
}

/** Beat three: together over one phone, and the card they open — a line and their voice. */
function TogetherScene() {
  return (
    <View style={styles.togetherStack}>
      <OnboardingPhoto photo={ONBOARDING_PHOTOS.together} aspectRatio={4 / 3} style={styles.photo} />
      <OpenedCard />
    </View>
  );
}

function OpenedCard() {
  return (
    <View style={styles.opened}>
      <View style={styles.openedHeader}>
        <Ionicons name="heart" size={16} color={palette.accent.heart} />
        <Text style={styles.openedPrompt}>Grateful</Text>
        <Text style={styles.openedFrom}>from them</Text>
      </View>
      <Text style={styles.openedText}>You made tea before I even asked. I noticed.</Text>
      <View style={styles.voice}>
        <Ionicons name="play" size={13} color={palette.partners.b} />
        <View style={styles.bars}>
          {[8, 14, 10, 18, 12, 16, 9, 13].map((h, i) => (
            <View key={i} style={[styles.bar, { height: h }]} />
          ))}
        </View>
        <Text style={styles.voiceTime}>0:07</Text>
      </View>
    </View>
  );
}

export default function IntroScreen() {
  const router = useRouter();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (beat >= BEATS.length - 1) return;
    const timer = setTimeout(() => setBeat((b) => b + 1), BEAT_MS);
    return () => clearTimeout(timer);
  }, [beat]);

  const current = BEATS[beat];

  return (
    <OnboardingFrame
      step={FUNNEL.intro}
      footer={
        <LunaraButton title="Continue" onPress={() => router.push('/(onboarding)/fox' as never)} />
      }
    >
      <OnboardingHeading title="Here’s a night with Lunara" />

      <View style={styles.stage}>
        <Animated.View
          key={current.key}
          entering={FadeIn.duration(duration.base)}
          exiting={FadeOut.duration(duration.fast)}
          style={styles.scene}
          accessible
          accessibilityRole="image"
          accessibilityLabel={current.caption}
        >
          {current.key === 'apart' && <ApartScene />}
          {current.key === 'both' && <CoupleCompanion state="glowing" size="hero" />}
          {current.key === 'open' && <TogetherScene />}
        </Animated.View>
      </View>

      <Animated.Text
        key={`caption-${current.key}`}
        entering={FadeIn.duration(duration.base)}
        style={styles.caption}
        maxFontSizeMultiplier={maxFontScale}
      >
        {current.caption}
      </Animated.Text>

      <View style={styles.dots}>
        {BEATS.map((b, i) => (
          <SpringPressable
            key={b.key}
            onPress={() => setBeat(i)}
            haptic="selection"
            feedback="highlight"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1} of ${BEATS.length}`}
            accessibilityState={{ selected: i === beat }}
          >
            <View style={[styles.dot, i === beat && styles.dotActive]} />
          </SpringPressable>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  // A fixed stage, so the caption and dots don't jump as beats of different
  // heights swap in.
  stage: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  scene: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  caption: {
    ...text.heading,
    color: palette.content[0],
    textAlign: 'center',
    minHeight: 56,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: palette.ink[4] },
  dotActive: { width: 22, backgroundColor: palette.accent.glow },

  photo: { maxWidth: 340 },
  locks: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.md,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: tint.night(0.72),
    borderWidth: 1,
    borderColor: tint.cream(0.12),
  },
  lockText: { ...text.caption },

  togetherStack: { width: '100%', alignItems: 'center' },

  opened: {
    width: '90%',
    maxWidth: 320,
    marginTop: -64,
    ...elevation.raised,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.heart(0.28),
    padding: space.xl,
    gap: space.md,
  },
  openedHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  openedPrompt: { ...text.label, color: palette.accent.heart },
  openedFrom: { ...text.caption, color: palette.content[2], marginLeft: 'auto' },
  openedText: { ...text.prose, color: palette.content[0] },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: tint.moon(0.3),
    backgroundColor: tint.cream(0.04),
  },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bar: { width: 3, borderRadius: radius.full, backgroundColor: palette.partners.b },
  voiceTime: { ...text.caption, color: palette.partners.b },
});
