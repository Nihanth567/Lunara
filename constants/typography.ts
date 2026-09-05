import { Platform, type TextStyle } from 'react-native';

/**
 * Lunara's type system.
 *
 * Replaces 245 hand-written `fontFamily` / `fontSize` / `letterSpacing` triples
 * spread across 20 screens. That approach produced 23 distinct font sizes
 * (10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 30, 32, 34, 36,
 * 38, 40, 44, 54) and letter-spacing on 33 of 249 text styles. Sizes one pixel
 * apart cannot express hierarchy — 11/12/13/14/15 all reading at once is why
 * dense screens felt flat and undesigned. A scale with deliberate gaps does the
 * work that a hundred near-identical sizes cannot.
 *
 * ─── Why two families ────────────────────────────────────────────────────────
 *
 * Everything was Inter. Inter is an excellent interface face and the single
 * most over-used typeface in software — it is the visual default of every
 * generated UI, which is exactly why an all-Inter product reads as untouched by
 * a designer. It also has no voice, and Lunara is a product people write to
 * their partner in at 11pm.
 *
 * `display` — **Fraunces**. A variable serif drawn with real optical sizing:
 *   its `opsz` axis thickens hairlines and opens counters at small sizes, so it
 *   stays legible where a high-contrast serif like Playfair (the reflexive
 *   "elegant" pick, and by now its own kind of default) would shatter. Warm,
 *   slightly idiosyncratic, and it does something Inter cannot: it makes the
 *   couple's own words look like they matter.
 *
 * `sans` — **Plus Jakarta Sans**. Geometric-humanist with a taller x-height
 *   than Inter, so labels and metadata hold up at 12–13px on a dark ground. It
 *   carries the interface without competing with the serif.
 *
 * Reserve the serif for display, numerals and the couple's own writing. Every
 * control, label and piece of chrome stays sans. A serif on a button is the
 * other way to look amateur.
 *
 * ─── Tracking ────────────────────────────────────────────────────────────────
 *
 * Optical, not decorative. Large text sets loose at its default spacing, so the
 * display steps carry negative tracking (-0.8 … -0.2) to close the gaps a
 * headline opens up. Small caps-y labels get positive tracking (+0.6 … +1.2)
 * because tight uppercase at 11px is unreadable. Body sits at 0 — tracking body
 * copy is a tell.
 */

export const fonts = {
  /** Fraunces — display, numerals, and the couple's own words. */
  display: 'Fraunces_600SemiBold',
  displayLight: 'Fraunces_400Regular',
  /** Plus Jakarta Sans — every control, label, and piece of chrome. */
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
} as const;

/**
 * Seven steps, each a clear jump from the last. If a size is not on this scale
 * it does not belong in the app — reach for the neighbouring step instead of
 * inventing 17px.
 *
 * `lineHeight` is absolute rather than a multiplier because React Native does
 * not accept unitless values, and is set tighter as size grows (1.5× at body,
 * 1.05× at hero) — the standard optical correction that keeps a headline from
 * looking double-spaced.
 *
 * ─── Eight steps, and the gaps are the point ─────────────────────────────────
 *
 * 12 · 14 · 16 · 18 · 22 · 28 · 40 · 52.
 *
 * The previous version of this file argued that "sizes one pixel apart cannot
 * express hierarchy" and then defined 12, 13, 14, 15, 16 and 17 — six steps
 * inside a five-pixel band. The screens duly spread 197 pieces of text across
 * those six near-identical sizes, which is most of why dense screens read as
 * undesigned. `label` and `overline` are now *styles* rather than sizes: they
 * reuse `body` and `caption` and let weight and tracking do the work, which is
 * what stops a scale from quietly growing a ninth and tenth step.
 */
export const type = {
  /**
   * The wordmark, and nothing else. One per app, not one per screen.
   */
  display: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1.2,
  } satisfies TextStyle,

  /** Reveal moments, the streak count, an empty state. One per screen at most. */
  hero: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
  } satisfies TextStyle,

  /** Screen titles. */
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  } satisfies TextStyle,

  /** Section headings, card titles, the name on a reveal card. */
  heading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  /**
   * The couple's own writing, wherever it is being read back. Serif on purpose:
   * their words are the content, not chrome, and should not be set in the same
   * face as a settings row.
   */
  prose: {
    fontFamily: fonts.displayLight,
    fontSize: 18,
    lineHeight: 28,
    letterSpacing: 0,
  } satisfies TextStyle,

  /** Default running text and text inputs. 16px so iOS never auto-zooms. */
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  } satisfies TextStyle,

  /** Secondary copy, helper text. */
  callout: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  } satisfies TextStyle,

  /** The smallest text allowed. Timestamps, stat labels, legal. */
  caption: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  } satisfies TextStyle,

  /**
   * Buttons, tabs, chips. Deliberately *not* its own size — it is `body` with
   * weight doing the work. A control needing a unique size to feel like a
   * control is a sign the weight ramp is too weak.
   */
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.1,
  } satisfies TextStyle,

  /**
   * Eyebrows and overlines. Also not its own size — `caption` with uppercase
   * and open tracking, because tight uppercase at 12px is unreadable.
   */
  overline: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
  } satisfies TextStyle,
} as const;

/**
 * Lining figures for anything that changes in place — a streak counter, a
 * timer, a stat that ticks up. Fraunces' numerals are proportional, so without
 * this a "9" narrower than a "0" makes the whole row jitter on every update.
 */
export const tabularNumerals: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/**
 * Cap Dynamic Type so a large accessibility setting enlarges text without
 * bursting fixed-height rows. Never disable scaling outright (`allowFontScaling
 * = false` fails WCAG 1.4.4) — bound it instead.
 *
 * Android ignores `maxFontSizeMultiplier` on some versions, hence the Platform
 * split rather than one shared value.
 */
export const maxFontScale = Platform.OS === 'ios' ? 1.4 : 1.3;
