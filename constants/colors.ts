import { radius } from './tokens';

/**
 * Lunara's colour system — dark, warm, romantic.
 *
 * ─── What changed, and why ───────────────────────────────────────────────────
 *
 * The previous ground was a near-neutral black (hue 240 at 9% saturation),
 * chosen to get away from the over-reproduced saturated-indigo "cosmic" look.
 * It succeeded at that and overshot: a product two people write to each other
 * in at 11pm read as a developer tool. Neutral is not the same as tasteful.
 *
 * This ground keeps the restraint — chroma stays low, type and space still
 * carry the hierarchy — but moves the hue to **plum/mauve (~290°)** and warms
 * the whites. It reads as candlelight rather than as a terminal, without
 * becoming the purple gradient wash that started this.
 *
 * ─── The rules ───────────────────────────────────────────────────────────────
 *
 * Pastels, but *deepened*. Every accent here is a soft pastel pulled down in
 * lightness until it can sit on a dark ground without glowing. A pastel at full
 * lightness on near-black is a highlighter; at these values it reads as blush,
 * which is the intent.
 *
 * Accents have rank.
 *   · `rose` is the only colour that means "act on this".
 *   · `lilac` is brand and ambience — never an action.
 *   · `mint` and `peach` are strictly semantic (done, streak), never decorative.
 *   · `blush` is a tint for fills and glows, not a text colour.
 *
 * Partner colours are a *pair*, not two picks. `partnerA` / `partnerB` are the
 * "each person gets their own colour" identity in the shared list, chosen to
 * stay distinguishable for the most common colour-vision deficiencies — they
 * differ in lightness as well as hue, so a checkmark is never identified by
 * hue alone.
 *
 * Contrast is verified, not eyeballed. Every text tier clears WCAG AA on every
 * surface it can land on; the worst case in the system is 5.07:1 (`content[2]`
 * on `ink[3]`). `roseDeep` is the one value below AA — it is a fill and border
 * colour only and must never carry small text.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

/**
 * Five surfaces. Hue held at ~290 with chroma tapering as the ramp lightens.
 * Steps are tight at the bottom and open as they rise, which is how a dark ramp
 * separates surfaces without banding.
 */
const ink = {
  /** The page. */
  0: '#150F19',
  /** Recessed wells, inputs, progress tracks. */
  1: '#1C1421',
  /** Cards and sheets. */
  2: '#251B2B',
  /** A surface raised above another surface. */
  3: '#312338',
  /** Hairlines and dividers — the top of the ramp. */
  4: '#42304A',
} as const;

/**
 * Three tiers, warm-white rather than blue-white so the page reads soft.
 * 14.88 / 8.91 / 5.70 on the card surface — separated enough that hierarchy
 * survives without reaching for a fourth tier.
 */
const content = {
  0: '#F8F1F6',
  1: '#CBB9C9',
  2: '#A492A6',
} as const;

/**
 * The accents.
 *
 * `rose` replaces coral as the primary. Coral was chosen when the palette was
 * neutral and needed one warm anchor; against a plum ground it turns muddy
 * orange. Rose is the same warmth re-tuned to the new hue family.
 */
const accent = {
  /** The single action colour. */
  rose: '#E8A0B4',
  /** Fills, borders, pressed states. Below AA — never small text. */
  roseDeep: '#C4718A',
  /** Tints and glows. */
  blush: '#F2C4CE',
  /** Brand and ambience. Never an action. */
  lilac: '#B9A5E3',
  /** Semantic only: complete. */
  mint: '#9BC9A8',
  /** Semantic only: a live streak. */
  peach: '#E8B98A',
  /** Semantic only: destructive. */
  danger: '#E27A85',
} as const;

/**
 * The two people. Distinguished by lightness as well as hue so the list stays
 * readable without relying on colour perception alone.
 */
const partners = {
  /** Whoever is holding the phone. */
  a: '#E8A0B4',
  /** The other one. */
  b: '#8FC5DE',
} as const;

// ─── Gradients ────────────────────────────────────────────────────────────────

/**
 * Shaping, not decoration. These stops sit within a ramp step of each other, so
 * a tall screen gets a barely perceptible lift toward its centre and nothing
 * that reads as a "gradient background".
 */
export const gradients = {
  screen: ['#150F19', '#1B1421', '#150F19'] as const,
  screenLocations: [0, 0.5, 1] as const,
  panel: ['#150F19', '#1C1421', '#150F19'] as const,
  /** The reveal earns the one visible gradient in the app, and it is still slight. */
  reveal: ['#150F19', '#221830', '#1A1222'] as const,
  revealLocations: [0, 0.55, 1] as const,
} as const;

// ─── Semantic tokens ──────────────────────────────────────────────────────────

const tokens = {
  background: ink[0],
  backgroundMid: '#1B1421',
  backgroundDeep: ink[1],

  surface: ink[2],
  surfaceSunk: ink[1],
  surfaceHigh: ink[3],
  card: ink[2],
  cardStrong: ink[3],
  cardForeground: content[0],
  cardBorder: 'rgba(248,241,246,0.08)',

  foreground: content[0],
  text: content[0],
  textSecondary: content[1],
  muted: ink[1],
  mutedForeground: content[2],

  onCardMuted: 'rgba(248,241,246,0.55)',
  onCardBody: 'rgba(248,241,246,0.86)',

  primary: accent.rose,
  primaryDeep: accent.roseDeep,
  primarySoft: accent.blush,
  /** Label on a rose fill — 9.08:1. */
  primaryForeground: ink[0],
  primaryGlow: accent.blush,

  /** "Secondary" is a neutral, not a second brand hue. */
  secondary: content[1],
  secondaryDeep: content[2],
  secondarySoft: content[0],
  secondaryForeground: ink[0],

  accent: accent.rose,
  accentForeground: content[0],

  border: 'rgba(248,241,246,0.08)',
  borderStrong: ink[4],
  input: 'rgba(248,241,246,0.05)',
  tint: accent.rose,

  success: accent.mint,
  streak: accent.peach,
  destructive: accent.danger,
  destructiveForeground: ink[0],

  /** The two people, wherever authorship is shown. */
  partnerA: partners.a,
  partnerB: partners.b,

  /**
   * The three prompts. Distinguished by label and order, with only a muted mark
   * of colour each — the card itself stays neutral.
   */
  gratefulColor: accent.rose,
  cuteColor: accent.lilac,
  growColor: accent.mint,
} as const;

export const palette = { ink, content, accent, partners } as const;

const colors = {
  light: tokens,
  dark: tokens,
  radius: { card: radius.lg, chip: radius.sm, dot: radius.xs },
};

export default colors;
