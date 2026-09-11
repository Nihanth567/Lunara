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
import { gradients } from '@/constants/colors';
import { radius } from '@/constants/tokens';

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
        <Animated.View style={[styles.masthead, enterStyle]}>
          <Text style={styles.eyebrow}>A nightly ritual for two</Text>
          <Text style={styles.wordmark}>Lunara</Text>
          <Text style={styles.tagline}>
            Three questions each night. Answered apart, opened together.
          </Text>
        </Animated.View>

        {/* The one element here that could not belong to another app. */}
        <Animated.View style={[styles.prompts, enterStyle]}>
          <View style={styles.promptRule} />
          <View style={styles.promptRow}>
            <Text style={styles.prompt}>Grateful</Text>
            <Text style={styles.promptSep}>/</Text>
            <Text style={styles.prompt}>Cute</Text>
            <Text style={styles.promptSep}>/</Text>
            <Text style={styles.prompt}>Grow</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.actions, actionsStyle]}>
          {/* Hugs its label instead of spanning the screen. A full-bleed pill
              is the default; a button sized to its content is a decision. */}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => router.push('/(onboarding)/intro' as never)}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Begin tonight</Text>
            <Ionicons name="arrow-forward" size={17} color="#150F19" />
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

  /* Bottom-anchored and set on one left margin. The space above is intentional
     and empty; it is not slack distributed between centred objects. */
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 30,
    gap: 34,
  },

  masthead: { gap: 12 },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#A492A6',
  },
  wordmark: {
    fontSize: 64,
    lineHeight: 66,
    fontFamily: 'Fraunces_600SemiBold',
    /* Negative. Large display type closes up; the old +3 spread it apart. */
    letterSpacing: -2,
    color: '#F8F1F6',
  },
  tagline: {
    fontSize: 17,
    lineHeight: 27,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#CBB9C9',
    maxWidth: 300,
  },

  prompts: { gap: 14 },
  promptRule: { height: 1, width: 44, backgroundColor: '#42304A' },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prompt: {
    fontSize: 15,
    fontFamily: 'Fraunces_400Regular',
    color: '#CBB9C9',
  },
  promptSep: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#42304A',
  },

  actions: { gap: 20, paddingTop: 6 },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#E8A0B4',
    paddingVertical: 15,
    paddingHorizontal: 26,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  ctaPressed: { opacity: 0.86 },
  ctaText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#150F19',
    letterSpacing: 0.1,
  },

  signInRow: { flexDirection: 'row' },
  signInText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#A492A6',
  },
  signInAction: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#CBB9C9',
  },
});
