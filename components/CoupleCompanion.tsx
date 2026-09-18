import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { NightFoxArt, type FoxPalette } from './NightFoxArt';
import { getMoonColor } from './MoonPhaseIndicator';
import {
  companionAccessibilityLabel,
  companionLabel,
  companionSubtitle,
  companionTier,
  type CompanionState,
} from '@/lib/companion';
import { palette as tokens } from '@/constants/colors';
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
 * ─── What the fox is for ─────────────────────────────────────────────────────
 *
 * It is the only thing in the app that belongs to *both* of them. The streak is
 * a number about them; the reveal is a thing they did; the fox is a third
 * party in the room that is brighter tonight because of something they both
 * did. That is the entire retention argument, and it only works if the animal
 * is *present* — big enough to be the subject of the screen rather than an icon
 * decorating one. Hence `hero`, and hence the rule that any screen showing the
 * fox at `hero` shows nothing else above the fold.
 *
 * ─── The halo is a light source, not a shape ─────────────────────────────────
 *
 * It used to be a translucent circle with a border radius, which on a dark
 * ground reads as exactly that: a disc. It is now an SVG radial gradient
 * falling off to fully transparent, so the fox appears to be *emitting* rather
 * than *sitting in front of* something. The difference is most of why the old
 * version read as a sticker.
 *
 * ─── It reacts ───────────────────────────────────────────────────────────────
 *
 * When `state` changes the fox pops — a short spring on scale plus a brightness
 * flash. This is what makes a partner's submission arriving over realtime feel
 * like something happening in the room rather than a re-render. The first mount
 * is exempt: arriving on a screen should not look like news.
 */

export type CompanionSize = 'sm' | 'md' | 'lg' | 'hero';

const ART_SIZE: Record<CompanionSize, number> = {
  /** The persistent header presence. The smallest the silhouette stays legible. */
  sm: 44,
  /** Inside a card, alongside copy. */
  md: 88,
  /** The emotional centre of a card that is mostly about the fox. */
  lg: 140,
  /** The hero zone. Owns the top of the ritual screen and the reveal. */
  hero: 188,
};

/** How far the halo extends past the art. Bigger art, proportionally softer light. */
const HALO_SCALE = 2.15;

/**
 * The companion's temperature, taken straight from `getMoonColor` rather than
 * restated here.
 *
 * Two copies of this ramp existed and drifted apart, which put a violet fox
 * above a gold moon describing the same streak on the same screen. One
 * function now owns it; see the note on `getMoonColor` for the tiers and for
 * why the first fortnight is no longer grey.
 *
 * Speck *count* still tiers separately, at 7/14/30 via `companionTier` — a
 * faster, quieter progression that gives the first week something to show for
 * itself.
 */
const companionAccent = getMoonColor;

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
 * Seven states, seven temperatures.
 *
 * Read the `halo` column top to bottom and you have the emotional arc of an
 * evening: violet while nothing has happened, apricot the moment one of you
 * shows up, warmer still when you both have. **Cool means waiting; warm means
 * together.** That is the one rule this table encodes, and it is the reason the
 * app can be understood from across a room.
 *
 * Nothing in here goes below "gently lit", and nothing in here is ever unwell —
 * the fox that missed four nights is asleep, which is a thing a healthy animal
 * does. There is no state in this table a single shared night does not fix.
 */
const VISUALS: Record<CompanionState, StateVisual> = {
  nesting: {
    palette: { fur: '#7A6AA8', furDeep: '#5B4E82', cream: '#E4DCCF', marking: '#A78BFA', feature: '#1A1524' },
    // Violet: nothing has happened yet, and the room is still cool.
    halo: tokens.accent.moon,
    haloOpacity: 0.12,
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
    palette: { fur: '#8C79BE', furDeep: '#6B5A94', cream: '#F2E6D6', marking: tokens.accent.glow, feature: '#221C30' },
    // The first warmth of the evening. One of you is here, so there is a light
    // on — and it is apricot, the same colour as the thing you tap.
    halo: tokens.accent.glow,
    haloOpacity: 0.2,
    // Sitting up. This is the animal's whole job — it waits up for someone.
    alertness: 0.95,
    breathMs: 2800,
    breathTo: 1.03,
    pulses: true,
    // The one detail that makes this state readable without reading anything.
    light: tokens.accent.glow,
    sparkBonus: 0,
    tinted: false,
  },
  ready: {
    palette: { fur: '#C9899C', furDeep: '#A3647A', cream: '#FFE9CC', marking: '#FFF0DA', feature: '#2B1A22' },
    // Both of you are in. Pink, and the brightest pre-reveal the fox gets.
    halo: tokens.accent.heart,
    haloOpacity: 0.3,
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
    palette: { fur: '#A98FD4', furDeep: '#8471B4', cream: '#F7F1E8', marking: '#FFF6EA', feature: '#221C30' },
    // The top of the range. Nothing else in the app is allowed to be this warm.
    halo: tokens.accent.glow,
    haloOpacity: 0.38,
    alertness: 1,
    breathMs: 2600,
    breathTo: 1.035,
    pulses: true,
    light: null,
    sparkBonus: 2,
    tinted: true,
  },
  streaklit: {
    palette: { fur: '#8674B4', furDeep: '#665789', cream: '#E8DCC9', marking: tokens.accent.streak, feature: '#221C30' },
    // Gold: yesterday's warmth, still on. Distinct from tonight's apricot on
    // purpose — a live streak should not be mistakable for a finished night.
    halo: tokens.accent.streak,
    haloOpacity: 0.22,
    alertness: 0.85,
    breathMs: 3200,
    breathTo: 1.03,
    pulses: true,
    light: null,
    sparkBonus: 1,
    tinted: true,
  },
  resting: {
    palette: { fur: '#5E5079', furDeep: '#4A3F63', cream: '#C9BDB0', marking: '#9A9084', feature: '#1A1524' },
    halo: tokens.content[1],
    // Dim, never dark. "Resting" has to look like a choice the animal made.
    haloOpacity: 0.1,
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
    palette: { fur: '#4C4064', furDeep: '#3D3352', cream: '#8C81A6', marking: '#9A9084', feature: '#1A1524' },
    halo: tokens.content[2],
    haloOpacity: 0.07,
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

/**
 * The halo. An SVG radial gradient rather than a rounded `<View>`, so the light
 * falls off to nothing instead of ending at an edge.
 *
 * Three stops rather than two: a linear ramp from 0.55 to 0 reads as a disc
 * with a soft edge, whereas holding most of the brightness inside the first
 * third and then dropping fast is how an actual light behaves.
 */
function Halo({ size, color }: { size: number; color: string }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.55} />
          <Stop offset="0.38" stopColor={color} stopOpacity={0.24} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

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
  const halo = art * HALO_SCALE;
  const accent = companionAccent(streak);

  // Honours the OS "Reduce Motion" switch. A breathing creature is the entire
  // point of this feature, so when motion is off it is drawn at its resting
  // pose and full glow rather than removed — the state still reads, it just
  // holds still.
  const reduceMotion = useReducedMotion();

  const breath = useSharedValue(1);
  const glow = useSharedValue(visual.haloOpacity);
  /** The reaction pop, multiplied into the breath. Idle at 1. */
  const react = useSharedValue(1);

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

  /**
   * The reaction. Fires when the state *changes*, never on first mount —
   * arriving on a screen is not news, but a partner submitting while you are
   * looking at it is. The whole thing lands in ~420ms, inside the 300–500ms
   * window where a change still reads as a response to something.
   */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) return;
    react.value = withSequence(
      withTiming(1.12, { duration: 160, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 190 }),
    );
  }, [react, reduceMotion, state]);

  // Two looping animations plus one transient, all on the UI thread and all
  // pure transforms — the whole motion budget for a component that is on
  // screen every single night.
  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value * react.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  // Only the specks take the tier colour. Tinting the fur would recolour the
  // animal itself every fortnight, and once commissioned art lands there is no
  // fur here to tint anyway — the specks are drawn by the app over both.
  const foxPalette: FoxPalette = visual.tinted
    ? { ...visual.palette, marking: accent }
    : visual.palette;
  const haloColor = visual.tinted ? accent : visual.halo;

  const sparks = companionTier(streak) + visual.sparkBonus;
  const text = label ?? companionLabel(state, { streak });
  const big = size === 'hero' || size === 'lg';

  return (
    <View
      style={[styles.container, big && styles.containerBig, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={companionAccessibilityLabel(state, { streak })}
    >
      <Animated.View style={[{ width: art, height: art }, styles.artWrap, breathStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { width: halo, height: halo, marginLeft: -(halo - art) / 2, marginTop: -(halo - art) / 2 },
            glowStyle,
          ]}
        >
          <Halo size={halo} color={haloColor} />
        </Animated.View>
        <NightFoxArt
          state={state}
          size={art}
          palette={foxPalette}
          sparks={sparks}
          light={visual.light}
          alertness={visual.alertness}
        />
      </Animated.View>

      {showLabel && (
        <Text
          style={[styles.label, big && styles.labelBig]}
          maxFontSizeMultiplier={maxFontScale}
          numberOfLines={2}
        >
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
  // At hero size the halo needs somewhere to go, or it clips against whatever
  // sits above and below it.
  containerBig: { gap: 14, paddingVertical: 12 },
  artWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: 0, left: 0 },
  label: {
    ...type.caption,
    color: tokens.content[1],
    textAlign: 'center',
  },
  /**
   * At hero size the line under the fox is bigger than a caption but stays in
   * the sans.
   *
   * It was briefly set in the serif, on the reasoning that the fox talking is
   * not chrome. On screen that put two centred serif lines a couple of steps
   * apart either side of the art, and they fought. The serif belongs to the
   * couple's own words and to the screen's own title; the fox's state is a
   * *label*, and labels are sans here — same rule as everywhere else.
   */
  labelBig: {
    ...type.body,
    color: tokens.content[1],
    textAlign: 'center',
  },
  subtitle: {
    ...type.callout,
    color: tokens.content[2],
    textAlign: 'center',
  },
});
