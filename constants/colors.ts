import { radius } from './tokens';

/**
 * Lunara's colour system.
 *
 * ─── What was wrong ──────────────────────────────────────────────────────────
 *
 * The old palette had six near-blacks that were not a ramp: `#1E1B3A` sat at
 * hue 254 while `#24243E` sat at 240, so two values a step apart in the UI
 * belonged to different hue families. Three "levels" of secondary text measured
 * 5.30, 4.99 and 4.61 against their own surfaces — a 0.7 spread, which the eye
 * reads as one flat tone rather than a hierarchy. And `#7A6D98`, documented as
 * the muted token, failed WCAG AA on every surface in the app (3.25:1 at worst).
 *
 * Four pastel accents — coral, lavender, sage, amber — all sat at roughly the
 * same lightness and chroma, so nothing dominated and everything competed.
 *
 * ─── The system ──────────────────────────────────────────────────────────────
 *
 * One hue family for every neutral (246–248°), with chroma *tapering* as the
 * ramp lightens (48% → 29%). Saturated darks and desaturated lights is what
 * keeps a dark interface from going muddy; the reverse is the single most
 * common way a dark theme looks amateur.
 *
 * Lightness steps are even by measurement, not by eye: ΔL* of +4.1, +3.7, +4.3,
 * +4.9. Text is three genuinely separated tiers — 15.7:1, 9.1:1, 5.4:1 — so
 * hierarchy is carried by contrast rather than by size alone.
 *
 * Accents keep their hues (a logo is being drawn against them) but gain tonal
 * steps and, more importantly, *rank*: coral is the only colour allowed to mean
 * "act on this", lavender carries brand and ambience, and sage and amber are
 * strictly semantic — a state, never a decoration.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

/**
 * The neutral ramp. One hue, even perceptual steps, chroma falling as it rises.
 * Nothing in the app should introduce a sixth near-black.
 */
const ink = {
  /** The page itself. */
  0: '#0A0817',
  /** Recessed wells, inputs, the track behind a progress bar. */
  1: '#121024',
  /** Cards and sheets — the workhorse surface. */
  2: '#1A1730',
  /** A card raised above another card. */
  3: '#23203D',
  /** Hairlines, dividers, and the top of the ramp. */
  4: '#2E2A4C',
} as const;

/**
 * Text, in three tiers that are actually distinguishable: 15.7:1, 9.1:1 and
 * 5.4:1 on `ink[2]`. Every tier clears WCAG AA for body copy on every surface
 * in the ramp — the worst case in the whole system is 4.87:1.
 */
const content = {
  /** Headlines, the couple's own words, anything that must be read. */
  0: '#F5F2FB',
  /** Supporting copy, captions that still carry meaning. */
  1: '#C0B8D4',
  /** Timestamps, stat labels, legal — present but never competing. */
  2: '#948BAC',
} as const;

/**
 * Accents. Hues preserved from the original brand; values re-cut so they can be
 * used at more than one weight without every surface turning pastel.
 */
const accent = {
  /** Action. The only colour that means "tap this". */
  coral: '#FF9A8B',
  coralDeep: '#E8705E',
  coralSoft: '#FFC4B8',

  /** Brand and ambience — the moon, the companion, anything atmospheric. */
  lavender: '#C3B1E1',
  lavenderDeep: '#9B85C9',
  lavenderSoft: '#DCD1EF',

  /** Semantic only: completion, growth, a night that landed. */
  sage: '#A8D8A8',
  /** Semantic only: a streak, a thing currently lit. Richer than the old
   *  #FFD6A5, which was pale enough to read as disabled. */
  amber: '#F0C07A',

  /** Semantic only: destructive. Never used decoratively. */
  danger: '#F2716B',
} as const;

// ─── Gradients ────────────────────────────────────────────────────────────────

/**
 * The app background, defined once.
 *
 * It used to be written inline in twelve files with four different stop
 * combinations, so "the Lunara background" was not one thing. It is now.
 *
 * The old mid-stop was `#302B63`, the bloom from a stock CSS gradient that
 * ships in a thousand generated apps and is recognisable on sight. This one is
 * built from the ramp itself: the lift in the middle is our own `ink[3]` pushed
 * slightly toward the lavender the brand already owns, so the background and
 * the surfaces on top of it are demonstrably the same family.
 */
export const gradients = {
  /** Full-screen app background. Symmetric, so scroll never reveals a seam. */
  screen: ['#0A0817', '#141127', '#221D40', '#141127', '#0A0817'] as const,
  screenLocations: [0, 0.28, 0.5, 0.72, 1] as const,
  /** Shorter surfaces — sheets, empty states, anything under ~500pt. */
  panel: ['#0A0817', '#1A1730', '#221D40'] as const,
  /** The reveal: warms toward the top, because that screen is the payoff. */
  reveal: ['#0A0817', '#171331', '#241C43', '#1A1730'] as const,
  revealLocations: [0, 0.3, 0.62, 1] as const,
} as const;

// ─── Semantic tokens ──────────────────────────────────────────────────────────

const tokens = {
  // Backgrounds
  background: ink[0],
  backgroundMid: '#141127',
  backgroundDeep: ink[3],

  // Surfaces
  surface: ink[2],
  surfaceSunk: ink[1],
  surfaceHigh: ink[3],
  card: ink[2],
  cardStrong: ink[3],
  cardForeground: content[0],
  /** Hairline on a card. Low enough to divide, not to outline. */
  cardBorder: 'rgba(255,255,255,0.09)',

  // Typography
  foreground: content[0],
  text: content[0],
  textSecondary: content[1],
  muted: ink[1],
  mutedForeground: content[2],

  /**
   * Copy set directly on a coloured card (the ritual prompts). Alpha rather
   * than a flat value so it composites correctly over coral, lavender or sage.
   */
  onCardMuted: 'rgba(255,255,255,0.58)',
  onCardBody: 'rgba(255,255,255,0.84)',

  // Accents
  primary: accent.coral,
  primaryDeep: accent.coralDeep,
  primarySoft: accent.coralSoft,
  /** Label on a coral fill — 9.67:1. */
  primaryForeground: ink[0],
  primaryGlow: accent.coralSoft,

  secondary: accent.lavender,
  secondaryDeep: accent.lavenderDeep,
  secondarySoft: accent.lavenderSoft,
  secondaryForeground: ink[0],

  accent: accent.lavender,
  accentForeground: content[0],

  // UI chrome
  border: 'rgba(255,255,255,0.09)',
  borderStrong: ink[4],
  input: 'rgba(255,255,255,0.06)',
  tint: accent.coral,

  // Semantic
  success: accent.sage,
  streak: accent.amber,
  destructive: accent.danger,
  destructiveForeground: '#FFFFFF',

  // Ritual card identities. Unchanged hues — these are how the three prompts
  // are recognised — but they now sit on a ramp that lets them breathe.
  gratefulColor: accent.coral,
  cuteColor: accent.lavender,
  growColor: accent.sage,
} as const;

export const palette = { ink, content, accent } as const;

/**
 * Dark is the only intended experience, so both keys resolve to the same
 * tokens and `useColors()` always returns the Lunara palette.
 */
const colors = {
  light: tokens,
  dark: tokens,
  // One curve scale for the whole app — see constants/tokens.ts. This key
  // used to declare card: 12 / chip: 8 / dot: 4, a second and contradictory
  // radius system living alongside `radius` in tokens.ts.
  radius: { card: radius.lg, chip: radius.sm, dot: radius.xs },
};

export default colors;
