import React, { useId } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { FOX_ART } from '@/assets/companion/fox';
import type { CompanionState } from '@/lib/companion';

/**
 * The night fox — Lunara's companion, drawn.
 *
 * ─── Two renderers, one component ────────────────────────────────────────────
 *
 * If `assets/companion/fox/` has a commissioned PNG for this state, that is
 * what draws. Otherwise the vector placeholder below does. Everything around
 * this file — the state machine, the placements, the halo, the breathing, the
 * copy — is identical either way, so the art can land one pose at a time and
 * the app is never in a broken half-state waiting for it.
 *
 * ─── The placeholder is deliberately not a character ─────────────────────────
 *
 * It is circles, triangles and four curves: enough to read "fox, sitting,
 * ears up" at 44pt, and nowhere near enough to be mistaken for finished art or
 * quietly shipped as it. Final character art is a human commission — see
 * `assets/companion/fox/README.md`. Nothing in this repo generates it.
 *
 * ─── Why a fox ───────────────────────────────────────────────────────────────
 *
 * The obvious pick was a moon, and the moon is taken: `MoonPhaseIndicator`
 * already owns that shape for the streak, so a second one reads as a second
 * counter rather than as something alive. A fox is nocturnal, it curls, its
 * ears are a whole emotional register on their own, and — the reason it is the
 * right animal for this product — it is the one that waits up for someone.
 */

export interface FoxPalette {
  /** Body and head, at the top. */
  fur: string;
  /** Body and head, at the bottom. The gradient runs between the two. */
  furDeep: string;
  /** Chest ruff, muzzle, tail tip, ear insides — everything paler. */
  cream: string;
  /** Star specks along the flank and tail. */
  marking: string;
  /** Eyes and nose. */
  feature: string;
}

interface Props {
  /** Picks the commissioned PNG when there is one. */
  state: CompanionState;
  /** Rendered edge length in points. The art is square. */
  size: number;
  /** Placeholder only. Commissioned art carries its own colour and is never tinted. */
  palette: FoxPalette;
  /**
   * Star specks along the flank and tail — 0 to 5. This is the streak tier made
   * visible: the same "something has been gathering" idea as the stars around
   * `MoonPhaseIndicator`, on the creature instead of the moon.
   *
   * Drawn by the app over either renderer, so the commissioned art leaves those
   * areas uncluttered rather than baking specks in.
   */
  sparks?: number;
  /**
   * The small warm light the fox keeps while a night is half-finished. Non-null
   * only in `waiting` — it is the literal reading of "holding a light for
   * them", and the one detail that makes that state legible in a 44pt glyph.
   */
  light?: string | null;
  /**
   * 0 = curled nose-to-tail, ears flat, eyes closed. 1 = sitting up, ears
   * forward, watching. Static per state; any breathing is applied by the parent
   * as a transform, so this component never animates and never re-renders on a
   * frame.
   *
   * Posture is how sleep is expressed. A dimmed awake fox reads as a rendering
   * bug, which is why this axis exists rather than an opacity.
   */
  alertness?: number;
}

/** Speck positions along the tail and the far flank. */
const SPARKS: { x: number; y: number }[] = [
  { x: 18, y: 57 },
  { x: 14, y: 46 },
  { x: 27, y: 43 },
  { x: 72, y: 68 },
  { x: 78, y: 58 },
];

const TAIL = 'M34 86 C 13 87, 4 70, 11 54 C 16 42, 27 39, 31 46 C 24 53, 20 66, 27 75 C 30 79, 33 83, 36 84 Z';
const BODY = 'M50 50 C 33 50, 25 65, 25 78 C 25 86, 34 91, 50 91 C 66 91, 75 86, 75 78 C 75 65, 67 50, 50 50 Z';
const HEAD = 'M50 22 C 37 22, 30 31, 30 42 C 30 52, 39 59, 50 59 C 61 59, 70 52, 70 42 C 70 31, 63 22, 50 22 Z';
const EAR = 'M59 26 C 62 16, 68 10, 71 12 C 74 14, 73 23, 68 30 Z';
const EAR_INNER = 'M62 25 C 64 19, 67 15, 69 16 C 70 18, 69 23, 66 27 Z';
const EYE_CLOSED = 'M37 42 C 39 45, 43 45, 45 42';

export function NightFoxArt({
  state,
  size,
  palette,
  sparks = 0,
  light = null,
  alertness = 1,
}: Props) {
  const commissioned = FOX_ART[state];
  const level = Math.min(Math.max(alertness, 0), 1);
  const visibleSparks = SPARKS.slice(0, Math.min(Math.max(sparks, 0), SPARKS.length));

  // Gradient ids are global to the SVG renderer, so two companions on one
  // screen (the header and a card, say) would otherwise share whichever
  // gradient mounted last — and the smaller one would silently take the
  // brighter one's colours.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const furGradient = `fox-fur-${uid}`;

  // Ears flatten and the head tucks down into the chest as the fox settles.
  // Both come off one axis so a state can never be half-asleep by accident.
  const earFold = (1 - level) * 46;
  const headDrop = (1 - level) * 13;
  const eyesOpen = level > 0.35;

  // Specks sit over whichever renderer is drawing, so the streak tier reads the
  // same on placeholder and commissioned art.
  const overlay = visibleSparks.length > 0 && (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {visibleSparks.map((s) => (
        <Circle key={`${s.x}-${s.y}`} cx={s.x} cy={s.y} r={1.6} fill={palette.marking} />
      ))}
    </Svg>
  );

  if (commissioned) {
    return (
      <View style={{ width: size, height: size }}>
        <Image
          source={commissioned}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        {overlay}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <SvgLinearGradient id={furGradient} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={palette.fur} />
            <Stop offset="1" stopColor={palette.furDeep} />
          </SvgLinearGradient>
        </Defs>

        {/* Tail first, so it wraps behind the body. */}
        <Path d={TAIL} fill={`url(#${furGradient})`} />
        <Ellipse cx={16} cy={48} rx={6} ry={7} fill={palette.cream} opacity={0.75} />

        <Path d={BODY} fill={`url(#${furGradient})`} />
        {/* Chest ruff — the pale mass that makes a fox read as a fox in
            silhouette, and the only thing keeping the body from being a blob. */}
        <Ellipse cx={50} cy={74} rx={14} ry={12} fill={palette.cream} opacity={0.5} />

        <G transform={`translate(0 ${headDrop})`}>
          {/* Ears, mirrored from one shape so the pair can never drift apart
              under an edit. Rotation anchors just above the skull. */}
          <G transform={`rotate(${earFold} 62 30)`}>
            <Path d={EAR} fill={palette.furDeep} />
            <Path d={EAR_INNER} fill={palette.cream} opacity={0.55} />
          </G>
          <G transform="translate(100 0) scale(-1 1)">
            <G transform={`rotate(${earFold} 62 30)`}>
              <Path d={EAR} fill={palette.furDeep} />
              <Path d={EAR_INNER} fill={palette.cream} opacity={0.55} />
            </G>
          </G>

          <Path d={HEAD} fill={`url(#${furGradient})`} />
          <Ellipse cx={50} cy={50} rx={10} ry={6.5} fill={palette.cream} opacity={0.62} />

          {eyesOpen ? (
            <G>
              <Circle cx={41} cy={41} r={2.6} fill={palette.feature} />
              <Circle cx={59} cy={41} r={2.6} fill={palette.feature} />
            </G>
          ) : (
            <G>
              <Path
                d={EYE_CLOSED}
                stroke={palette.feature}
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
              />
              <G transform="translate(100 0) scale(-1 1)">
                <Path
                  d={EYE_CLOSED}
                  stroke={palette.feature}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            </G>
          )}

          <Ellipse cx={50} cy={47} rx={2.8} ry={2.2} fill={palette.feature} />
        </G>

        {light && (
          <G>
            <Circle cx={79} cy={26} r={7.5} fill={light} opacity={0.22} />
            <Circle cx={79} cy={26} r={3.2} fill={light} />
          </G>
        )}
      </Svg>
      {overlay}
    </View>
  );
}
