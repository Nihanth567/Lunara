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
 * ─── Why one rounded family ─────────────────────────────────────────────────
 *
 * **Nunito**, everywhere. Its terminals are rounded, which is most of what
 * makes a typeface read as *cozy* rather than *designed* — the same reason the
 * friendliest consumer apps (Cal AI, Finch) set their headlines in a soft,
 * heavy sans instead of a serif. It replaced Fraunces + Plus Jakarta Sans: a
 * sharp serif over a geometric sans looked considered, but it felt like an
 * editorial product, and this is one two people open in bed at 11pm.
 *
 * One family also means one less decision on every screen. Hierarchy comes
 * from weight and size alone:
 *
 *   800 ExtraBold — display, titles, big numbers
 *   700 Bold      — headings, buttons, labels
 *   600 SemiBold  — captions and small labels (Nunito runs light, so small
 *                   text on a dark ground needs the extra weight)
 *   500 Medium    — the couple's own words, read back
 *   400 Regular   — running text and inputs
 *
 * Still not Inter: Inter is the visual default of generated UI, and it has no
 * warmth at all.
 *
 * ─── Tracking ────────────────────────────────────────────────────────────────
 *
 * Optical, not decorative. Large text sets loose at its default spacing, so the
 * display steps carry negative tracking (-1 … -0.2) to close the gaps a
 * headline opens up. Small caps-y labels get positive tracking (+0.6 … +1.2)
 * because tight uppercase at 11px is unreadable. Body sits at 0 — tracking body
 * copy is a tell.
 */

export const fonts = {
  /** Display, titles and numerals. */
  display: 'Nunito_800ExtraBold',
  /** The couple's own words, read back. */
  displayLight: 'Nunito_500Medium',
  sans: 'Nunito_400Regular',
  sansMedium: 'Nunito_600SemiBold',
  sansSemiBold: 'Nunito_700Bold',
  sansBold: 'Nunito_800ExtraBold',
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
 * 12 · 14 · 16 · 18 · 22 · 26 · 34 · 44.
 *
 * The top three steps came down from 28 / 40 / 52. A 52px serif wordmark over a
 * 40px hero is *stately* — it is the type scale of a masthead, and it was
 * fighting the thing the product is actually for. At 44 / 34 / 26 the same
 * hierarchy survives intact while a screen title stops declaiming and a fox
 * caption sits at conversational size. Warmth in type is mostly a question of
 * not shouting.
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
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
  } satisfies TextStyle,

  /** Reveal moments, the streak count, an empty state. One per screen at most. */
  hero: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  } satisfies TextStyle,

  /** Screen titles. */
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  } satisfies TextStyle,

  /** Section headings, card titles, the name on a reveal card. */
  heading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  /**
   * The couple's own writing, wherever it is being read back. Larger and a
   * touch heavier than body, so their words read as the content, not chrome.
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
 * timer, a stat that ticks up. Nunito's numerals are proportional, so without
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
