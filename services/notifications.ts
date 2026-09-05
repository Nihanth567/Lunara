import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  reminderHour: number;   // 0–23
  reminderMinute: number; // 0–59
}

/**
 * Reminders default ON. The nightly notification is the trigger the whole habit
 * loop hangs off — shipping it off-by-default meant the only people who ever
 * got a nudge were the ones who went looking for the setting. Nothing is sent
 * until the OS permission is actually granted, and the toggle is one tap away
 * in Us → Notifications.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  reminderHour: 21, // 9 PM
  reminderMinute: 0,
};

const REMINDER_ID = 'lunara_nightly_reminder';
const CHECK_BACK_ID = 'lunara_grow_checkback';
const PROTECT_ID = 'lunara_streak_protection';
const CHECK_BACK_DATA_TYPE = 'grow-check-back';
const PROTECT_DATA_TYPE = 'streak-protection';
/** Late morning — a quiet hour that doesn't compete with the nightly reminder. */
const CHECK_BACK_HOUR = 10;
const REMINDER_DATA_TYPE = 'nightly-reminder';
// Keep the rolling window below iOS's limit for pending local notifications.
const REMINDER_DAYS_AHEAD = 30;

/** Request OS notification permissions. Returns true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  if (existing === 'denied') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Check whether notification permissions have already been granted. */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reminderTimeHasPassed(now: Date, hour: number, minute: number): boolean {
  return (
    now.getHours() > hour ||
    (now.getHours() === hour && now.getMinutes() >= minute)
  );
}

function reminderIdentifier(date: Date): string {
  return `${REMINDER_ID}_${dateKey(date)}`;
}

function getFirstDayOffset(now: Date, hour: number, minute: number, skipToday: boolean): number {
  return skipToday || reminderTimeHasPassed(now, hour, minute) ? 1 : 0;
}

/**
 * Rotating nightly copy. The same sentence every night stops being an
 * invitation and starts being an alarm — varying it keeps the nudge feeling
 * like the app rather than the OS. Indexed by date so both partners get the
 * same line on the same night.
 */
const NIGHTLY_MESSAGES: { title: string; body: string }[] = [
  { title: 'A quiet moment is waiting 🌙', body: 'Three small questions, whenever you have a minute.' },
  { title: 'Tonight’s cards are ready 🌙', body: 'Something grateful, something cute, something to grow.' },
  { title: 'Your partner’s night is winding down too 🌙', body: 'Take a minute to meet them here.' },
  { title: 'One small ritual before sleep 🌙', body: 'It only takes a minute, and it keeps the thread going.' },
  { title: 'A little space held for you two 🌙', body: 'Share tonight’s three when you’re ready.' },
];

function nightlyMessage(date: Date): { title: string; body: string } {
  const dayIndex = Math.floor(date.getTime() / 86400000);
  const count = NIGHTLY_MESSAGES.length;
  return NIGHTLY_MESSAGES[((dayIndex % count) + count) % count];
}

async function scheduleReminderForDate(date: Date): Promise<void> {
  const { title, body } = nightlyMessage(date);
  await Notifications.scheduleNotificationAsync({
    identifier: reminderIdentifier(date),
    content: {
      title,
      body,
      data: {
        screen: 'tonight',
        notificationType: REMINDER_DATA_TYPE,
      },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

function getReminderDates(
  now: Date,
  hour: number,
  minute: number,
  skipToday: boolean,
): Date[] {
  const firstDayOffset = getFirstDayOffset(now, hour, minute, skipToday);
  return Array.from({ length: REMINDER_DAYS_AHEAD }, (_, index) => {
    const dayOffset = firstDayOffset + index;
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset,
      hour,
      minute,
      0,
      0,
    );
  });
}

/**
 * Schedule (or reschedule) the nightly reminders.
 *
 * Local notifications cannot conditionally inspect whether today's ritual was
 * submitted. A rolling set of dated notifications lets us remove tonight's
 * reminder after submission while keeping tomorrow and later nights scheduled.
 */
export async function scheduleNightlyReminder(
  hour: number,
  minute: number,
  options: { skipToday?: boolean } = {},
): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelNightlyReminder();

  await refreshNightlyReminder(hour, minute, options);
}

/**
 * Keep the future reminder window full without replacing still-pending
 * notifications. Call this whenever Lunara becomes active.
 */
export async function refreshNightlyReminder(
  hour: number,
  minute: number,
  options: { skipToday?: boolean } = {},
): Promise<void> {
  if (Platform.OS === 'web') return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(scheduled.map((request) => request.identifier));
  const reminderDates = getReminderDates(new Date(), hour, minute, options.skipToday ?? false);

  for (const reminderDate of reminderDates) {
    if (!scheduledIds.has(reminderIdentifier(reminderDate))) {
      await scheduleReminderForDate(reminderDate);
    }
  }
}

/** Cancel the scheduled nightly reminder. */
export async function cancelNightlyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const reminderIds = scheduled
      .filter(
        (request) =>
          request.identifier === REMINDER_ID ||
          request.content.data?.notificationType === REMINDER_DATA_TYPE,
      )
      .map((request) => request.identifier);

    // Include the legacy identifier in case a daily reminder was created by
    // an earlier app version and is not returned by the platform query.
    reminderIds.push(REMINDER_ID);
    await Promise.all(
      [...new Set(reminderIds)].map((identifier) =>
        Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {
          // Not scheduled — safe to ignore
        }),
      ),
    );
  } catch {
    // If querying scheduled notifications is unavailable, still clean up the
    // legacy reminder identifier.
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {
      // Not scheduled — safe to ignore
    });
  }
}

// ─── Streak protection ─────────────────────────────

/**
 * The one notification in Lunara that exists because of loss aversion — and
 * the one that most needs to not feel like a threat.
 *
 * It is a *single* late nudge on a night where a live streak is still
 * unfinished. Everything about it is bounded on purpose:
 *
 *  - only when the couple actually has a run going (>= MIN_PROTECTED_STREAK),
 *    so it never lands on someone with nothing to lose;
 *  - only when tonight isn't done, so engaged couples never see it at all;
 *  - exactly one pending notification at a time, re-evaluated on every state
 *    refresh, so it self-corrects instead of stacking;
 *  - copy that says the night is still open, never that they are about to fail.
 *
 * Combined with the nightly reminder, a couple who forgets sees two touches on
 * that night and none on the nights they show up — which is what keeps the
 * whole app inside a 2–5 touches/week budget.
 */

/** Below this a "streak" is too new for loss aversion to be anything but nagging. */
export const MIN_PROTECTED_STREAK = 2;

/** The window a protection nudge is allowed to land in. */
const PROTECT_EARLIEST_HOUR = 21;
const PROTECT_EARLIEST_MINUTE = 30;
const PROTECT_LATEST_HOUR = 23;
const PROTECT_LATEST_MINUTE = 0;
/** Breathing room after the nightly reminder so the two never arrive together. */
const PROTECT_OFFSET_MINUTES = 90;

function protectIdentifier(date: string): string {
  return `${PROTECT_ID}_${date}`;
}

/**
 * When tonight's protection nudge should fire: well after the nightly reminder,
 * but still at an hour someone might pick up their phone.
 */
export function protectionTime(
  reminderHour: number,
  reminderMinute: number,
): { hour: number; minute: number } {
  const offset = reminderHour * 60 + reminderMinute + PROTECT_OFFSET_MINUTES;
  const earliest = PROTECT_EARLIEST_HOUR * 60 + PROTECT_EARLIEST_MINUTE;
  const latest = PROTECT_LATEST_HOUR * 60 + PROTECT_LATEST_MINUTE;
  const clamped = Math.min(Math.max(offset, earliest), latest);
  return { hour: Math.floor(clamped / 60), minute: clamped % 60 };
}

/**
 * Warm, specific, never about failing. The streak is named because a number
 * someone recognises is what makes this worth opening — but the sentence
 * around it stays an invitation.
 */
function protectionMessage(streak: number): { title: string; body: string } {
  if (streak >= 30) {
    return {
      title: `${streak} nights, still going 🌙`,
      body: 'Tonight is still open — a minute now keeps it whole.',
    };
  }
  if (streak >= 7) {
    return {
      title: `Your ${streak} nights are still safe 🌙`,
      body: 'There’s still time tonight, if you want it.',
    };
  }
  return {
    title: 'Tonight’s still open 🌙',
    body: `You’re ${streak} ${streak === 1 ? 'night' : 'nights'} in. One minute keeps the thread going.`,
  };
}

/**
 * Schedule (or clear) tonight's streak-protection nudge.
 *
 * Safe and cheap to call on every state change: it cancels any stale nudge
 * first, so the pending set never holds more than tonight's.
 */
export async function refreshStreakProtection(options: {
  enabled: boolean;
  streak: number;
  todayComplete: boolean;
  reminderHour: number;
  reminderMinute: number;
}): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelStreakProtection();

  const { enabled, streak, todayComplete, reminderHour, reminderMinute } = options;
  if (!enabled || todayComplete || streak < MIN_PROTECTED_STREAK) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const { hour, minute } = protectionTime(reminderHour, reminderMinute);
  const now = new Date();
  const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  // Already past — tonight simply doesn't get one rather than firing instantly.
  if (when.getTime() <= Date.now()) return;

  const { title, body } = protectionMessage(streak);
  await Notifications.scheduleNotificationAsync({
    identifier: protectIdentifier(dateKey(now)),
    content: {
      title,
      body,
      data: { screen: 'tonight', notificationType: PROTECT_DATA_TYPE },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  }).catch(() => {
    // Optional by design — a refused schedule costs nothing.
  });
}

/** Drop any pending protection nudge — on submit, sign-out, or settings off. */
export async function cancelStreakProtection(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((r) => r.content.data?.notificationType === PROTECT_DATA_TYPE)
        .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier).catch(() => {})),
    );
  } catch {
    // Nothing queryable means nothing pending.
  }
}

// ─── Grow check-back ──────────────────────────────────────────────

function checkBackIdentifier(guidanceDate: string): string {
  return `${CHECK_BACK_ID}_${guidanceDate}`;
}

/**
 * One warm, local nudge the morning after a couple saw guidance on their Grow
 * notes. Deliberately a single notification per guidance day — the check-back
 * is one question, not a coaching sequence, so it never re-fires or chases.
 *
 * Safe to call repeatedly: the identifier is derived from the guidance date, so
 * re-scheduling replaces rather than stacks. A time already in the past is
 * skipped rather than firing immediately.
 */
export async function scheduleGrowCheckBack(guidanceDate: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const when = new Date(guidanceDate + 'T00:00:00');
  when.setDate(when.getDate() + 1);
  when.setHours(CHECK_BACK_HOUR, 0, 0, 0);
  if (when.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: checkBackIdentifier(guidanceDate),
    content: {
      title: 'A small check-in 🌱',
      body: 'Did you try a small step from yesterday’s Grow note? No wrong answer.',
      data: {
        screen: 'tonight',
        notificationType: CHECK_BACK_DATA_TYPE,
        guidanceDate,
      },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  }).catch(() => {
    // A check-back nudge is the most optional notification in the app — if the
    // OS refuses it (quota, permissions revoked mid-session), let it go.
  });
}

/** Drop a pending check-back once it's been answered in the app. */
export async function cancelGrowCheckBack(guidanceDate: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(checkBackIdentifier(guidanceDate)).catch(() => {
    // Not scheduled — safe to ignore.
  });
}

/**
 * Register this device for remote push notifications and return its Expo push
 * token. The caller is responsible for saving it (e.g. to the user's Supabase
 * profile) so a server can address this device.
 *
 * `requestPermission` defaults to **false**, and that default matters. This is
 * called on every sign-in and every cold start, so requesting here meant the OS
 * dialog appeared the instant someone finished creating an account — before
 * Lunara had explained that the notifications in question are "your partner
 * shared tonight" and "you're both ready to reveal". On iOS a declined prompt
 * cannot be asked again from inside the app, so one badly-timed dialog
 * permanently cost the trigger half of the habit loop. Pass true only from a
 * screen that has just primed the ask.
 */
export async function registerForPushNotificationsAsync(
  options: { requestPermission?: boolean } = {},
): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const granted = options.requestPermission
    ? await requestNotificationPermissions()
    : (await getNotificationPermissionStatus()) === 'granted';
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data;
  } catch {
    return null;
  }
}

/** Format hour + minute into a human-readable string like "9:00 PM". */
export function formatReminderTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}
