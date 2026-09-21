import { radius } from './tokens';

/**
 * Lunara's colour system — "night nursery for two".
 *
 * ─── What changed, and why ───────────────────────────────────────────────────
 *
 * The previous ground was a plum ramp (~290°) with a rose accent: restrained,
 * correct, and emotionally *cool*. It read as a well-made journalling tool. The
 * product it is attached to is two people keeping a small creature lit together
 * at 11pm, and a well-made journalling tool is not what that feels like.
 *
 * This ground keeps the discipline — low chroma on the large surfaces, verified
 * contrast, accents with rank — and moves the temperature. The night gets
 * *deeper* and slightly bluer (a room with the lights off), and everything warm
 * is reserved for the moments that earn it: the fox's light, a reveal, a
 * streak. The contrast between a cool dark room and one warm source is the
 * whole feeling. A screen that is uniformly warm has no candle in it.
 *
 * ─── The rules ───────────────────────────────────────────────────────────────
 *
 * **Large surfaces stay night.** The four `ink` steps are the room. Nothing
 * decorative happens on them. Warmth arrives as a *light* — a glow, a halo, a
 * fill — never as a wash over the whole page.
 *
 * **Whites are cream, blacks are violet.** `#F7F1E8` rather than `#FFFFFF`;
 * `#0E0B14` rather than `#000000`. Pure white on pure black is a terminal.
 *
 * **Accents have rank, and the rank is the product.**
 *   · `glow` (apricot) is the fox's light and the only colour that means
 *     "act on this". Primary CTAs, active states, the thing to tap.
 *   · `heart` (coral-pink) is love. The reveal, reactions, the person holding
 *     the phone. Never used for a generic button.
 *   · `moon` (violet) is secondary actions and ambience. Never an action.
 *   · `success` and `streak` are strictly semantic. Never decorative.
 *   · `danger` is soft on purpose — a missed night is not an error, and this
 *     app never shows a harsh red to a couple.
 *
 * **Partner colours are a pair, not two picks.** `partnerA` / `partnerB` differ
 * in lightness as well as hue, so authorship survives the common colour-vision
 * deficiencies and is never carried by hue alone.
 *
 * ─── Contrast is verified, not eyeballed ─────────────────────────────────────
 *
 * Every text tier clears WCAG AA (4.5:1) on every one of the four surfaces it
 * can land on. Worst case in the system is `content[2]` on `ink[3]` at 4.80:1.
 *
 * `content[2]` is `#9A9084` rather than the `#8F857A` the spec named: that
 * value measured 4.16:1 on `ink[3]` and 4.55:1 on `ink[2]`, i.e. one failure
 * and one value a rounding error away from failing. `#9A9084` is the same warm
 * taupe two steps lighter and clears AA everywhere. Verify a new value with a
 * contrast check rather than trusting that it looks fine on your display.
 *
 * Every accent also clears AA as *text* on all four surfaces (lowest: `moon` at
 * 5.53:1 on `ink[3]`), and every accent used as a *fill* carries `ink[0]` as
 * its label at 7:1 or better. There is no value in this file that has to be
 * handled carefully — that is the point of retuning them all at once.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

/**
 * The room. Four surfaces plus a hairline, hue held around 265° with chroma
 * tapering as the ramp lightens.
 *
 * Deliberately one step deeper at the bottom than the old ramp: the warm
 * accents only read as *light* if the thing behind them is properly dark.
 */
const ink = {
  /** `bg.night` — the page. */
  0: '#0E0B14',
  /** `bg.elevated` — recessed wells, inputs, the gradient's middle. */
  1: '#1A1524',
  /** `bg.card` — cards and sheets. The workhorse. */
  2: '#221C30',
  /** `bg.soft` — a surface raised above another surface. */
  3: '#2A2338',
  /** Hairlines and dividers — the top of the ramp. */
  4: '#3A3149',
} as const;

/**
 * Three tiers, warm cream rather than blue-white, so a dark screen reads as a
 * lit room rather than as a display that is switched on.
 * 14.65 / 8.92 / 5.24 on the card surface.
 */
const content = {
  /** `ink.primary` */
  0: '#F7F1E8',
  /** `ink.secondary` */
  1: '#C9BDB0',
  /** `ink.muted` — see the note above on why this is not `#8F857A`. */
  2: '#9A9084',
} as const;

/**
 * The accents. Five meanings, and every one of them is a feeling rather than a
 * severity level — there is no "info blue" here because there is nothing in
 * this product to be informed about.
 */
const accent = {
  /** The fox's light, and the single action colour. */
  glow: '#FFB86B',
  /** Fills, borders, pressed states — a step down from `glow`. */
  glowDeep: '#E0955A',
  /** Halos and tints. Not a text colour. */
  glowSoft: '#FFD4B0',
  /** Love. Reveal, reactions, the person holding the phone. */
  heart: '#FF7A9A',
  /** Heart, a step down — fills and borders. */
  heartDeep: '#E05A7D',
  /** Secondary actions and ambience. Never an action. */
  moon: '#A78BFA',
  /** Semantic only: both of you finished. */
  success: '#7DDEB5',
  /** Semantic only: a live streak. */
  streak: '#F0C75E',
  /** Semantic only: destructive. Soft, never harsh — see the note above. */
  danger: '#E89B9B',
} as const;

/**
 * The two people. Distinguished by lightness as well as hue so the shared list
 * stays readable without relying on colour perception alone.
 */
const partners = {
  /** Whoever is holding the phone. */
  a: '#FF7A9A',
  /** The other one. */
  b: '#8FC5DE',
} as const;

// ─── Gradients ────────────────────────────────────────────────────────────────

/**
 * Shaping, not decoration.
 *
 * `screen` stays within a ramp step of itself: a tall screen gets a barely
 * perceptible lift toward its centre and nothing that reads as a "gradient
 * background". `warm` and `reveal` are the exceptions and they are earned —
 * both are apricot bleeding up from the bottom of a night ground, which is what
 * a lit room actually looks like, and both are attached to the two moments in
 * the app worth lighting up for.
 */
export const gradients = {
  screen: ['#0E0B14', '#171122', '#0E0B14'] as const,
  screenLocations: [0, 0.5, 1] as const,
  panel: ['#0E0B14', '#1A1524', '#0E0B14'] as const,
  /** Tonight, once both of you are in it. Warmth rising from underneath. */
  warm: ['#0E0B14', '#1C1426', '#2A1C2C'] as const,
  warmLocations: [0, 0.55, 1] as const,
  /** The reveal earns the one genuinely visible gradient in the app. */
  reveal: ['#0E0B14', '#241830', '#33212E'] as const,
  revealLocations: [0, 0.55, 1] as const,
  /** Behind the fox, wherever it is the hero. Apricot falling off to nothing. */
  foxHalo: ['rgba(255,184,107,0.20)', 'rgba(255,184,107,0.05)', 'rgba(255,184,107,0)'] as const,
} as const;

// ─── Semantic tokens ──────────────────────────────────────────────────────────

const tokens = {
  background: ink[0],
  backgroundMid: '#171122',
  backgroundDeep: ink[1],

  surface: ink[2],
  surfaceSunk: ink[1],
  surfaceHigh: ink[3],
  card: ink[2],
  cardStrong: ink[3],
  cardForeground: content[0],
  cardBorder: 'rgba(247,241,232,0.08)',

  foreground: content[0],
  text: content[0],
  textSecondary: content[1],
  muted: ink[1],
  mutedForeground: content[2],

  onCardMuted: 'rgba(247,241,232,0.55)',
  onCardBody: 'rgba(247,241,232,0.86)',

  /** The thing to tap. Apricot, because it is the same light the fox carries. */
  primary: accent.glow,
  primaryDeep: accent.glowDeep,
  primarySoft: accent.glowSoft,
  /** Label on a glow fill — 11.44:1. */
  primaryForeground: ink[0],
  primaryGlow: accent.glowSoft,

  /** Love, wherever the product is being affectionate rather than useful. */
  heart: accent.heart,
  heartDeep: accent.heartDeep,
  heartForeground: ink[0],

  /** Secondary actions. Violet, and never mistakable for the primary. */
  secondary: accent.moon,
  secondaryDeep: '#8B6BE0',
  secondarySoft: '#C9B8FF',
  secondaryForeground: ink[0],

  accent: accent.glow,
  accentForeground: content[0],

  border: 'rgba(247,241,232,0.08)',
  borderStrong: ink[4],
  input: 'rgba(247,241,232,0.05)',
  tint: accent.glow,

  success: accent.success,
  streak: accent.streak,
  destructive: accent.danger,
  destructiveForeground: ink[0],

  /** The two people, wherever authorship is shown. */
  partnerA: partners.a,
  partnerB: partners.b,

} as const;

export const palette = { ink, content, accent, partners } as const;

/**
 * The three prompts. One muted mark of colour each; the card itself stays
 * neutral so three of them in a column read as a set rather than a traffic
 * light.
 *
 * ─── Why this is a map and not three tokens ──────────────────────────────────
 *
 * It used to be `gratefulColor` / `cuteColor` / `growColor` on the semantic
 * token object, and nothing ever read them. Both surfaces that draw the three
 * prompts — the reveal and a past moment — spelled the colours out themselves
 * instead, and duly drifted: `Grateful` was `heart` on the reveal and `glow` in
 * Moments, so the same answer changed colour depending on which screen you read
 * it back on. `glow` is also the wrong choice on its own terms — it is the
 * "act on this" colour, and a category dot is not an action.
 *
 * Exported as one map so there is exactly one place to disagree with.
 */
export const promptAccent = {
  grateful: accent.heart,
  cute: accent.moon,
  grow: accent.success,
} as const;

/**
 * Soft glow shadows, for the things that are supposed to be giving off light —
 * the primary CTA, the fox's halo, a card at the moment it completes.
 *
 * Coloured rather than black: a warm button on a night ground with a black
 * shadow reads as a sticker sitting on top of the page, and the same button
 * with an apricot shadow reads as a source. iOS only; Android gets `elevation`
 * via `constants/tokens.ts` and no colour, which is the correct fallback.
 */
export const glow = {
  /** Under the primary CTA. */
  primary: {
    shadowColor: accent.glow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
  },
  /** Under anything affectionate — the reveal button, a reaction. */
  heart: {
    shadowColor: accent.heart,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
  },
  /** Under a completed / both-of-you-are-here surface. */
  success: {
    shadowColor: accent.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
} as const;

/**
 * Translucent tints, for fills that have to sit on an unknown surface. Pulled
 * out as a table because the same four opacities were being hand-typed as
 * `rgba(...)` literals in thirty files, and a hand-typed alpha is how a design
 * system quietly grows a second palette.
 */
export const tint = {
  glow: (a: number) => `rgba(255,184,107,${a})`,
  heart: (a: number) => `rgba(255,122,154,${a})`,
  moon: (a: number) => `rgba(167,139,250,${a})`,
  success: (a: number) => `rgba(125,222,181,${a})`,
  streak: (a: number) => `rgba(240,199,94,${a})`,
  cream: (a: number) => `rgba(247,241,232,${a})`,
  night: (a: number) => `rgba(14,11,20,${a})`,
} as const;

const colors = {
  light: tokens,
  dark: tokens,
  radius: { card: radius.lg, chip: radius.sm, dot: radius.xs },
};

export default colors;
