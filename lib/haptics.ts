import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Every haptic in Lunara, named for what it means rather than how hard it is.
 *
 * The app had sixty-one raw `expo-haptics` calls choosing between five
 * intensities by taste, so the same kind of moment buzzed differently on
 * different screens — a reaction tap was Light in one place, a card tap Medium
 * in another, and the nudge fired Medium where every other button fired Light.
 * A haptic is a word in a vocabulary; if the same word means two things, it
 * stops meaning anything. Call sites pick a meaning here and never an
 * intensity.
 *
 * Rules the vocabulary encodes:
 *
 * - **Success is earned, not predicted.** `success()` fires once the thing has
 *   actually happened (saved, purchased, sent) — never on the tap that starts
 *   it. A phone that congratulates a write which then fails is lying.
 * - **Errors are soft.** `error()` is the Warning pattern, not Error. This app
 *   never shows a couple a harsh red, and it doesn't buzz one at them either.
 * - **Nothing continuous.** No haptic on scroll, on keystrokes, or on anything
 *   that can fire faster than a person can decide to do it.
 *
 * Every call is fire-and-forget and swallows its own rejection: a device with
 * no Taptic Engine, or the web build, must never surface a haptic failure as
 * an unhandled promise.
 */

const enabled = Platform.OS !== 'web';

function run(fn: () => Promise<void>) {
  if (!enabled) return;
  fn().catch(() => {});
}

export const haptic = {
  /** An ordinary tap on a button, card or row. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Choosing between options: tabs, segments, a plan, a pager page. */
  selection: () => run(() => Haptics.selectionAsync()),

  /** Something the person did has landed: saved, sent, purchased, restored. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** It didn't work. Soft on purpose — see the note above. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /**
   * A reaction on the reveal. Soft rather than Light: this is meant to feel
   * like reaching over and squeezing a hand, not like pressing a button.
   */
  reaction: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),

  /** The mic opening. Firmer than a tap, so you know it is listening. */
  recordStart: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** The mic closing. `success()` follows separately once the take is saved. */
  recordStop: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** "Open tonight" — the one tap that unseals something. */
  unlock: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /**
   * The reveal arriving, paced to the cards rather than fired at once: a soft
   * touch as the first answer rises, then the warm confirmation once both
   * sides are on screen. Returns a cancel, for an unmount mid-sequence.
   */
  revealSequence: (landsAtMs: number): (() => void) => {
    const timers = [
      setTimeout(() => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)), 160),
      setTimeout(
        () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
        landsAtMs,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  },
} as const;
