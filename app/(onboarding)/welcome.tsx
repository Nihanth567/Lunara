import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { CoupleCompanion } from '@/components/CoupleCompanion';
import { gradients, glow, palette, tint } from '@/constants/colors';
import { type as text } from '@/constants/typography';
import { radius, space } from '@/constants/tokens';

/**
 * The first screen.
 *
 * ─── What this replaced ──────────────────────────────────────────────────────
 *
 * A glowing orb centred at the top, a centred wordmark, a centred tagline, a
 * full-width pill, and a centred sign-in link — laid out with
 * `justifyContent: 'space-between'`, which distributed the slack *between* the
 * blocks and left a void through the middle of the screen.
 *
 * Every one of those is a default. Centre-aligning every element is the most
 * reliable signature of a layout nobody composed; a soft-glow circle is what
 * stands in for a logo when there isn't one; and a full-bleed pill button is
 * the stock call to action. The palette was never what made this screen read as
 * generic.
 *
 * ─── What it does instead ────────────────────────────────────────────────────
 *
 * Everything is set left on one margin and anchored to the bottom, so the empty
 * space above is deliberate negative space rather than a gap between floating
 * objects. The type carries the screen: a large Fraunces wordmark with the
 * *negative* tracking display type actually needs (the old one was set at +3,
 * which spreads a serif and reads as amateur at 52px), over an eyebrow and a
 * concrete sub-line.
 *
 * The three prompts are named on the first screen. They are the one thing on it
 * that could not belong to any other product, and they say what Lunara is
 * faster than a tagline can.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const enter = useSharedValue(0);
  const actions = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      actions.value = 1;
      return;
    }
    const ease = Easing.out(Easing.cubic);
    enter.value = withTiming(1, { duration: 620, easing: ease });
    actions.value = withDelay(180, withTiming(1, { duration: 620, easing: ease }));
  }, [actions, enter, reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actions.value,
    transform: [{ translateY: (1 - actions.value) * 14 }],
  }));

  return (
    <LinearGradient
      colors={gradients.screen}
      locations={gradients.screenLocations}
      style={styles.container}
    >
      <StarField />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 },
        ]}
      >
        {/*
          The fox, before the wordmark. The empty upper half of this screen was
          described in an earlier pass as "deliberate negative space", which was
          true and is no longer what this screen is for: the first thing anyone
          should see is the animal, because the animal is the promise. The type
          below it now has something to be the caption of.
        */}
        <Animated.View style={[styles.foxSlot, enterStyle]}>
          <CoupleCompanion state="nesting" streak={0} size="hero" />
        </Animated.View>

        <Animated.View style={[styles.masthead, enterStyle]}>
          <Text style={styles.wordmark}>Lunara</Text>
          <Text style={styles.tagline}>
            A little fox you keep lit together. Three questions a night — written
            apart, opened at the same time.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actions, actionsStyle]}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => router.push('/(onboarding)/intro' as never)}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Start tonight</Text>
            <Ionicons name="arrow-forward" size={17} color={palette.ink[0]} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/(onboarding)/auth')}
            style={styles.signInRow}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.signInText}>Already have an account?</Text>
            <Text style={styles.signInAction}> Sign in</Text>
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Bottom-weighted: the fox takes the room above, the words and the way in sit
     under it on one left margin. */
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 30,
    gap: space.xxl,
  },

  foxSlot: { alignItems: 'center', marginBottom: space.sm },

  masthead: { gap: space.md },
  wordmark: {
    ...text.display,
    fontSize: 58,
    lineHeight: 62,
    letterSpacing: -1.8,
    color: palette.content[0],
  },
  tagline: { ...text.body, lineHeight: 26, color: palette.content[1], maxWidth: 320 },

  actions: { gap: space.lg + 4, paddingTop: space.xs + 2 },
  /* Hugs its label instead of spanning the screen, and it is a pill — the same
     shape as every other primary action in the app. */
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 1,
    backgroundColor: palette.accent.glow,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl + space.xs,
    borderRadius: radius.full,
    borderCurve: 'continuous',
    ...glow.primary,
  },
  ctaPressed: { opacity: 0.86 },
  ctaText: { ...text.label, color: palette.ink[0] },

  signInRow: { flexDirection: 'row' },
  signInText: { ...text.callout, color: palette.content[2] },
  signInAction: {
    ...text.callout,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: palette.accent.glow,
  },
});
