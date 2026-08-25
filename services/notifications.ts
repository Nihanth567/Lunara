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

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  reminderHour: 21, // 9 PM
  reminderMinute: 0,
};

const REMINDER_ID = 'lunara_nightly_reminder';
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

async function scheduleReminderForDate(date: Date): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: reminderIdentifier(date),
    content: {
      title: "A quiet moment is waiting for you 🌙",
      body: 'Take a minute tonight to share your heart with your partner.',
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

/**
 * Register this device for remote push notifications and return its Expo push
 * token. The caller is responsible for saving it (e.g. to the user's Supabase
 * profile) so a server can address this device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const granted = await requestNotificationPermissions();
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
