import React, { useEffect } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { NightFoxArt, type FoxPalette } from './NightFoxArt';
import {
  companionAccessibilityLabel,
  companionLabel,
  companionSubtitle,
  companionTier,
  type CompanionState,
} from '@/lib/companion';
import { type, maxFontScale } from '@/constants/typography';

/**
 * The couple's companion, on screen.
 *
 * State comes in, a creature comes out. Every decision about *what state we're
 * in* belongs to `lib/companion.ts`; `NightFoxArt` owns the drawing; everything
 * here is temperature, posture, motion and one optional line of copy — in that
 * order, because the brief this was built to is "readable in one glance, label
 * second".
 *
 * The palette table below only reaches the vector placeholder and the streak
 * specks. Once commissioned art lands in `assets/companion/fox/`, the fox
 * carries its own colour and the only things this component still contributes
 * are the halo, the breath and the specks — by design, so nothing here has to
 * change on the day the art arrives.
 *
 * Deliberately not a card. It is placed *inside* the surfaces that already
 * exist (the header, the waiting card, the reveal) rather than adding another
 * box to the home screen — a retention layer that costs the ritual a scroll
 * position has already failed.
 */

export type CompanionSize = 'sm' | 'md' | 'lg';

const ART_SIZE: Record<CompanionSize, number> = {
  /** The persistent header presence. The smallest the silhouette stays legible. */
  sm: 44,
  /** Inside a card, alongside copy. */
  md: 76,
  /** The hero moment — waiting, and the reveal. */
  lg: 116,
};

/**
 * The companion's temperature follows `getMoonColor()` exactly, thresholds and
 * all, so the moon in `MoonPhaseIndicator` and the fox are never two different
 * colours of the same streak on the same screen. The only change is that the
 * sub-14-night steps are solid rather than translucent lavender: this value is
 * used as an SVG fill, where an alpha channel is not reliably honoured.
 *
 * Speck *count* tiers separately, at 7/14/30 — a faster, quieter progression
 * that gives the first week something to show for itself.
 */
function companionAccent(streak: number): string {
  if (streak < 14) return '#C3B1E1';
  if (streak < 30) return '#F0C07A';
  if (streak < 60) return '#A8D8A8';
  if (streak < 100) return '#FF9A8B';
  return '#F5F2FB';
}

interface StateVisual {
  palette: FoxPalette;
  /** Soft halo behind the art. */
  halo: string;
  haloOpacity: number;
  /** Curled and asleep (0) to sitting up and watching (1). */
  alertness: number;
  /** Breath cycle in ms, and how far the scale travels. */
  breathMs: number;
  breathTo: number;
  /** Does the halo pulse, or sit still? */
  pulses: boolean;
  /** The small warm light the fox keeps while a night is half-finished. */
  light: string | null;
  /** Specks beyond the streak tier — `glowing` earns a couple extra. */
  sparkBonus: number;
  /** Streak-coloured states take their specks from `companionAccent`. */
  tinted: boolean;
}

/**
 * Seven states, seven temperatures. Read the column of `haloOpacity` values
 * top to bottom and you have the whole emotional range: 0.06 asleep, 0.30 on
 * the night you both showed up. Nothing in here goes below "gently lit", and
 * nothing in here is ever unwell — the fox that missed four nights is sleeping,
 * which is a thing a healthy animal does.
 */
const VISUALS: Record<CompanionState, StateVisual> = {
  nesting: {
    palette: { fur: '#6E5F92', furDeep: '#54486F', cream: '#C0B8D4', marking: '#C3B1E1', feature: '#2A2340' },
    halo: '#C3B1E1',
    haloOpacity: 0.1,
    // Settled in the den, ears half — awake, but nothing has happened yet.
    alertness: 0.55,
    breathMs: 4200,
    breathTo: 1.02,
    pulses: false,
    light: null,
    sparkBonus: 0,
    tinted: false,
  },
  waiting: {
    palette: { fur: '#8C79BE', furDeep: '#6B5A94', cream: '#E4DAF6', marking: '#F0C07A', feature: '#1A1730' },
    halo: '#C3B1E1',
    haloOpacity: 0.18,
    // Sitting up. This is the animal's whole job — it waits up for someone.
    alertness: 0.95,
    breathMs: 2800,
    breathTo: 1.03,
    pulses: true,
    // The one detail that makes this state readable without reading anything.
    light: '#F0C07A',
    sparkBonus: 0,
    tinted: false,
  },
  ready: {
    palette: { fur: '#C98D8F', furDeep: '#A0656E', cream: '#FFE9CC', marking: '#FFF0DA', feature: '#2B1A22' },
    halo: '#F0C07A',
    haloOpacity: 0.26,
    alertness: 1,
    // The quickest breath of the seven — anticipation, not urgency.
    breathMs: 1900,
    breathTo: 1.045,
    pulses: true,
    light: null,
    sparkBonus: 1,
    tinted: false,
  },
  glowing: {
    palette: { fur: '#9C86C8', furDeep: '#7A68A6', cream: '#F5F2FB', marking: '#FFF6EA', feature: '#1A1730' },
    halo: '#C3B1E1',
    haloOpacity: 0.3,
    alertness: 1,
    breathMs: 2600,
    breathTo: 1.035,
    pulses: true,
    light: null,
    sparkBonus: 2,
    tinted: true,
  },
  streaklit: {
    palette: { fur: '#7E6CAC', furDeep: '#61537F', cream: '#D8CCF0', marking: '#C3B1E1', feature: '#1A1730' },
    halo: '#C3B1E1',
    haloOpacity: 0.2,
    alertness: 0.85,
    breathMs: 3200,
    breathTo: 1.03,
    pulses: true,
    light: null,
    sparkBonus: 1,
    tinted: true,
  },
  resting: {
    palette: { fur: '#57496F', furDeep: '#453A5C', cream: '#C0B8D4', marking: '#948BAC', feature: '#121024' },
    halo: '#C0B8D4',
    // Dim, never dark. "Resting" has to look like a choice the animal made.
    haloOpacity: 0.09,
    // Lying low, ears down — but the eyes stay open, above the 0.35 threshold.
    // A fox that has stopped watching is a fox that gave up, and it hasn't.
    alertness: 0.42,
    breathMs: 4600,
    breathTo: 1.018,
    pulses: false,
    light: null,
    sparkBonus: 0,
    tinted: false,
  },
  sleeping: {
    palette: { fur: '#463B5C', furDeep: '#392F4C', cream: '#8478A0', marking: '#948BAC', feature: '#121024' },
    halo: '#948BAC',
    haloOpacity: 0.06,
    // Asleep is posture, not opacity: curled nose-to-tail, ears flat, eyes shut.
    alertness: 0.1,
    breathMs: 5600,
    breathTo: 1.012,
    pulses: false,
    light: null,
    sparkBonus: 0,
    tinted: false,
  },
};

interface Props {
  state: CompanionState;
  /** Drives speck count and, on the lit states, the accent colour. */
  streak?: number;
  size?: CompanionSize;
  /** Short warm line under the art. Off by default — the art speaks first. */
  showLabel?: boolean;
  /** The longer second line. Only worth it where a card has the room. */
  showSubtitle?: boolean;
  /**
   * Override the default label. `useCompanion()` passes a side-aware one for
   * `waiting`, which is the only state where the generic copy can be wrong.
   */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function CoupleCompanion({
  state,
  streak = 0,
  size = 'md',
  showLabel = false,
  showSubtitle = false,
  label,
  style,
}: Props) {
  const visual = VISUALS[state];
  const art = ART_SIZE[size];
  const accent = companionAccent(streak);

  // Honours the OS "Reduce Motion" switch. A breathing creature is the entire
  // point of this feature, so when motion is off it is drawn at its resting
  // pose and full glow rather than removed — the state still reads, it just
  // holds still.
  const reduceMotion = useReducedMotion();

  const breath = useSharedValue(1);
  const glow = useSharedValue(visual.haloOpacity);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 1;
      glow.value = visual.haloOpacity;
      return;
    }
    breath.value = withRepeat(
      withTiming(visual.breathTo, {
        duration: visual.breathMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    glow.value = visual.pulses
      ? withRepeat(
          withTiming(visual.haloOpacity, {
            duration: Math.round(visual.breathMs * 0.9),
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        )
      : visual.haloOpacity;
    // Re-seeded on state change so a couple who submits mid-session watches the
    // companion change rather than finding it already changed.
  }, [breath, glow, reduceMotion, visual]);

  // Two animations, both on the UI thread, both pure transforms — the whole
  // motion budget for a component that is on screen every single night.
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  // Only the specks take the tier colour. Tinting the fur would recolour the
  // animal itself every fortnight, and once commissioned art lands there is no
  // fur here to tint anyway — the specks are drawn by the app over both.
  const palette: FoxPalette = visual.tinted
    ? { ...visual.palette, marking: accent }
    : visual.palette;
  const halo = visual.tinted ? accent : visual.halo;

  const sparks = companionTier(streak) + visual.sparkBonus;
  const text = label ?? companionLabel(state, { streak });

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={companionAccessibilityLabel(state, { streak })}
    >
      <Animated.View style={[{ width: art, height: art }, styles.artWrap, breathStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              width: art * 1.55,
              height: art * 1.55,
              borderRadius: art * 0.775,
              backgroundColor: halo,
            },
            glowStyle,
          ]}
        />
        <NightFoxArt
          state={state}
          size={art}
          palette={palette}
          sparks={sparks}
          light={visual.light}
          alertness={visual.alertness}
        />
      </Animated.View>

      {showLabel && (
        <Text style={styles.label} maxFontSizeMultiplier={maxFontScale} numberOfLines={2}>
          {text}
        </Text>
      )}
      {showSubtitle && (
        <Text style={styles.subtitle} maxFontSizeMultiplier={maxFontScale}>
          {companionSubtitle(state, { streak })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  artWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  label: {
    ...type.caption,
    color: '#C0B8D4',
    textAlign: 'center',
  },
  subtitle: {
    ...type.callout,
    color: '#948BAC',
    textAlign: 'center',
  },
});
