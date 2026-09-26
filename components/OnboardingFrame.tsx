import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StarField } from '@/components/StarField';
import { SpringPressable } from '@/components/SpringPressable';
import { QUESTIONS } from '@/lib/onboardingQuiz';
import type { OnboardingPhotoAsset } from '@/assets/images/onboarding';
import { gradients, palette, tint } from '@/constants/colors';
import { duration, hitSlopFor, pressScale, radius, space } from '@/constants/tokens';
import { type as text, maxFontScale } from '@/constants/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Where each screen sits in the first-run funnel, for the progress bar.
 *
 * The paywall is not counted: it is the destination the bar is filling
 * towards, and a bar that kept going past it would suggest the ask is only
 * the middle of something.
 */
export const FUNNEL = {
  intro: 1,
  fox: 2,
  quiz: 3,
  belief: 3 + QUESTIONS.length,
  notifications: 4 + QUESTIONS.length,
  building: 5 + QUESTIONS.length,
  total: 5 + QUESTIONS.length,
} as const;

interface FrameProps {
  /** 1-based position in `FUNNEL`. */
  step: number;
  children: React.ReactNode;
  /** Pinned under the scroll: the screen's one action. */
  footer?: React.ReactNode;
  /** Defaults to leaving the screen. The quiz steps back through its own questions. */
  onBack?: () => void;
  /** Off while something is saving, so a half-finished write can't be walked away from. */
  canGoBack?: boolean;
}

/**
 * The shell every funnel screen shares: the night ground, a back arrow, a thin
 * progress bar, and the action pinned to the bottom.
 *
 * The bar starts where the previous screen left it and fills to this one, so
 * moving forward reads as one bar filling rather than a new bar on every
 * screen. Content scrolls, so a large Dynamic Type setting on a small phone
 * pushes the answers down instead of under the button.
 */
export function OnboardingFrame({ step, children, footer, onBack, canGoBack = true }: FrameProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue((step - 1) / FUNNEL.total);

  useEffect(() => {
    progress.value = withTiming(step / FUNNEL.total, { duration: duration.base });
  }, [progress, step]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <LinearGradient
      colors={gradients.screen}
      locations={gradients.screenLocations}
      style={styles.container}
    >
      <StarField />
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        {canGoBack ? (
          <SpringPressable
            onPress={onBack ?? (() => router.back())}
            scaleTo={pressScale.icon}
            hitSlop={hitSlopFor(32)}
            style={styles.back}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={palette.content[1]} />
          </SpringPressable>
        ) : (
          <View style={styles.back} />
        )}
        <View
          style={styles.track}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Getting set up"
          accessibilityValue={{ min: 0, max: FUNNEL.total, now: step }}
        >
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>{footer}</View>
      ) : null}
    </LinearGradient>
  );
}

/** A screen's title and its one supporting line. */
export function OnboardingHeading({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title} maxFontSizeMultiplier={maxFontScale} accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text style={styles.body} maxFontSizeMultiplier={maxFontScale}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

interface PhotoProps {
  photo: OnboardingPhotoAsset;
  /** Width over height. The frame spans the column; this sets how tall it is. */
  aspectRatio?: number;
  /** Laid over the bottom of the photo — lock chips, a caption. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * One photograph from the funnel's set, framed like a card.
 *
 * The bottom darkens into the night ground, so anything laid over it stays
 * legible and the photo reads as lit from inside the page rather than pasted
 * on top. It fades in as it decodes — and simply appears under Reduce Motion.
 */
export function OnboardingPhoto({ photo, aspectRatio = 1, children, style }: PhotoProps) {
  const reduceMotion = useReducedMotion();
  return (
    <View
      style={[styles.photo, { aspectRatio }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={photo.label}
    >
      <Image
        source={photo.source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={reduceMotion ? 0 : duration.base}
      />
      <LinearGradient
        colors={[tint.night(0), tint.night(0.6)]}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

interface ChoiceProps {
  label: string;
  detail?: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * One large answer. A whole-card target, because these are chosen with a thumb
 * mid-scroll, and a radio rather than a button so VoiceOver says which one is
 * picked.
 */
export function ChoiceCard({ label, detail, icon, selected, onPress }: ChoiceProps) {
  return (
    <SpringPressable
      onPress={onPress}
      haptic="selection"
      scaleTo={pressScale.card}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}>
        <Ionicons
          name={icon as IconName}
          size={20}
          color={selected ? palette.accent.glow : palette.content[1]}
        />
      </View>
      <View style={styles.choiceText}>
        <Text style={styles.choiceLabel} maxFontSizeMultiplier={maxFontScale}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.choiceDetail} maxFontSizeMultiplier={maxFontScale}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={palette.accent.glow} />
      ) : (
        <View style={styles.choiceRadio} />
      )}
    </SpringPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: palette.ink[3],
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.accent.glow,
    borderRadius: radius.full,
    transformOrigin: 'left',
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md },

  photo: {
    width: '100%',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: palette.ink[2],
    borderWidth: 1,
    borderColor: tint.cream(0.06),
  },

  heading: { gap: space.sm },
  title: { ...text.title, color: palette.content[0] },
  body: { ...text.body, color: palette.content[1], lineHeight: 25 },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: palette.ink[4],
  },
  choiceSelected: { borderColor: tint.glow(0.45), backgroundColor: tint.glow(0.08) },
  choiceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: tint.cream(0.05),
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconSelected: { backgroundColor: tint.glow(0.14) },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { ...text.label, color: palette.content[0] },
  choiceDetail: { ...text.caption, color: palette.content[2] },
  choiceRadio: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: palette.ink[4],
  },
});
