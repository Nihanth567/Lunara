import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import type { CompanionState } from './companion';

const APP_GROUP = 'group.com.lunara.app.widget';

const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

/**
 * What tonight looks like from the home screen, without opening the app.
 *
 * The widget is the cheapest daily touchpoint Lunara has, so it carries state
 * rather than decoration: whether tonight is still open, whether the partner is
 * waiting, whether a reveal is sitting there unread. Those are the three moments
 * worth walking across the room for.
 *
 * Deliberately *not* on the widget: anything either partner wrote. A home
 * screen is visible to whoever is holding the phone, and the reveal gate would
 * mean nothing if the words leaked onto a lock screen.
 */
export type WidgetStatus =
  /** No couple yet, or an invite that nobody has accepted. */
  | 'unpaired'
  /** Tonight's three are still blank. */
  | 'open'
  /** You've shared; they haven't yet. */
  | 'waiting'
  /** Both shared, nothing opened yet — the highest-intent state there is. */
  | 'ready'
  /** Done for tonight. */
  | 'complete';

export interface WidgetData {
  streak: number;
  status: WidgetStatus;
  /** A live run that tonight hasn't renewed yet — drives the soft amber tint. */
  atRisk: boolean;
  /** One night is being stepped over to keep this run alive. */
  streakProtected: boolean;
  /**
   * The couple's companion, as a mood only — no copy, no counter, just which
   * of the seven states tints the little mark in the corner of the widget.
   *
   * Carried rather than re-derived in Swift because the state machine lives in
   * `lib/companion.ts` and there is no version of "reimplement it in the
   * extension" that stays in step with it. `status` alone can't stand in: it
   * has nothing to say about a couple who simply hasn't opened the app in four
   * days, which is exactly the couple a home-screen glance is for.
   */
  companion: CompanionState;
}

/**
 * Push the latest snapshot to the iOS home screen widget. No-ops off iOS.
 *
 * Deliberately carries no entitlement. This used to write an `isPro` key
 * described here as gating "a Lunara Pro perk", but nothing was ever gated:
 * `targets/widget/` never reads the key, there is no locked state to render,
 * and `PRO_FEATURES` (lib/entitlements.ts) does not sell the widget — so the
 * comment claimed a paid feature the app gives away. It also cost a real
 * WidgetKit reload every time an entitlement changed, spending the daily budget
 * on a value with no reader. The widget is free for everyone, and says so by
 * not mentioning it.
 */
export function updateWidgetData(data: WidgetData): void {
  if (!storage) return;
  storage.set('streak', data.streak);
  storage.set('status', data.status);
  storage.set('atRisk', data.atRisk ? 1 : 0);
  storage.set('streakProtected', data.streakProtected ? 1 : 0);
  storage.set('companion', data.companion);
  // Kept for widgets built against the previous key set, so an app update that
  // lands before the extension update doesn't blank the home screen.
  storage.set('ritualComplete', data.status === 'complete' ? 1 : 0);
  storage.set('isPaired', data.status === 'unpaired' ? 0 : 1);
  ExtensionStorage.reloadWidget();
}
