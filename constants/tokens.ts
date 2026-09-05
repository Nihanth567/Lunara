import { Platform, type ViewStyle } from 'react-native';

/**
 * Geometry, depth and rhythm — the non-colour half of the design system.
 *
 * Before this, the app used 15 distinct corner radii (1, 2, 3, 5, 6, 8, 9, 10,
 * 12, 14, 16, 20, 80, 999 and one blank), with `borderRadius: 12` on 44
 * separate elements. A single radius applied to everything from a 320pt card
 * to a 24pt chip is the most reliable signature of an interface nobody drew:
 * corners have to scale with the surface they belong to or a big card looks
 * stiff and a small chip looks like a blob.
 */

/**
 * Radius scales with the element. The rule: pick the step whose surface size
 * matches, never the one that "looks about right" in isolation.
 */
export const radius = {
  /** Progress bars, tiny indicators, the stripe down a reveal card. */
  xs: 3,
  /** Chips, badges, inline tags. */
  sm: 8,
  /** Inputs, list rows, secondary buttons. */
  md: 14,
  /** Cards and primary buttons — the workhorse. */
  lg: 20,
  /** Sheets, modals, and the largest hero surfaces. */
  xl: 28,
  /** Avatars, icon wells, anything genuinely circular. */
  full: 9999,
} as const;

/**
 * A 4pt rhythm. Macro spacing (`xl` and up) is deliberately generous: the
 * fastest way to make a dense screen read as designed rather than as a dump of
 * components is to let its sections breathe, and 24pt between groups does more
 * for perceived quality than any amount of decoration inside them.
 */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Depth on a near-black ground.
 *
 * Every card in the app was `borderWidth: 1` + `rgba(255,255,255,0.08)`, which
 * is the default "glass card" recipe and reads as flat: a hairline is an
 * outline, not elevation. Real depth on a dark UI comes from a *lighter
 * surface* plus a shadow that is actually visible against #0F0C29 — which means
 * a wide, soft, low-opacity black, not the default grey shadow that vanishes.
 *
 * Android gets `elevation`; iOS gets the shadow triple. Both are set so a card
 * lifts without announcing itself.
 */
export const elevation = {
  /** Flush with the background. Section headers, inline groups. */
  flat: {} satisfies ViewStyle,

  /** Cards, rows, anything sitting on the page. */
  raised: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
    default: {},
  }) as ViewStyle,

  /** The primary CTA and anything that should feel pressable. */
  lifted: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
    },
    android: { elevation: 8 },
    default: {},
  }) as ViewStyle,

  /** Sheets and modals sitting above a scrim. */
  overlay: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.55,
      shadowRadius: 40,
    },
    android: { elevation: 16 },
    default: {},
  }) as ViewStyle,
} as const;

/**
 * A true 1px rule at any density. `borderWidth: 1` is one *point*, so on a 3×
 * screen it renders three device pixels — a visibly chunky line that reads as
 * a border rather than a division. Sub-pixel hairlines are what make a
 * settings list look native.
 */
export const hairline = Platform.OS === 'android' ? 0.5 : 0.33;

/**
 * Minimum tappable area. Apple asks 44pt, Material 48dp; take the larger so one
 * number is correct on both platforms.
 *
 * Anything visually smaller than this keeps its size and gains `hitSlop` — the
 * target grows, the design does not.
 */
export const touchTarget = 48;

/** `hitSlop` that brings a visually-smaller control up to `touchTarget`. */
export function hitSlopFor(visualSize: number) {
  const pad = Math.max(0, Math.round((touchTarget - visualSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}

/**
 * Motion. Enter slower than exit — a panel that leaves at the same speed it
 * arrived feels sluggish, because dismissal should acknowledge the tap
 * immediately. Exits sit at ~65% of their entrance, per Material's motion spec.
 *
 * Everything here is inside the 150–300ms band where a transition reads as
 * responsive; above ~400ms the user is waiting on the animation.
 */
export const duration = {
  /** Press feedback, colour changes. */
  instant: 100,
  /** The default for state changes. */
  fast: 180,
  /** Cards expanding, sheets arriving. */
  base: 260,
  /** Exit counterpart to `base`. */
  exit: 170,
} as const;

/**
 * The scrim behind a modal. 0.6 rather than the more common 0.3–0.4: on a
 * background this dark a weak scrim leaves the page competing with the sheet
 * instead of receding behind it.
 */
export const scrim = 'rgba(6, 4, 20, 0.6)';
