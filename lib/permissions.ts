import { Alert, Linking, Platform } from 'react-native';

/** The shape both `expo-audio` and `expo-notifications` report. */
interface PermissionState {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
}

interface AskWithReason {
  check: () => Promise<PermissionState>;
  request: () => Promise<{ granted: boolean }>;
  /** A short title for the ask. */
  title: string;
  /** ONE plain sentence: what the permission is for, in the couple's terms. */
  reason: string;
  /** The yes button. Names what happens next ("Allow microphone"), never "OK". */
  allowLabel: string;
  /**
   * What to say when it has already been declined and only Settings can bring
   * it back. Omit to stay silent — onboarding should never nag.
   */
  blocked?: { title: string; body: string };
}

/**
 * Ask for a permission the way a person would: say why first.
 *
 * The system dialog can be shown once per install, and a "Don't Allow" is
 * permanent from the app's side. Firing it cold — at the tap on a mic, with no
 * context — is how an app burns its one chance. So every permission goes
 * through the same two steps:
 *
 * 1. **Undetermined:** a plain alert with one sentence of why. "Not now" costs
 *    nothing and leaves the real permission unasked for a better moment.
 * 2. **Already declined:** an alert that says so and offers Settings, which is
 *    the only way back. Saying "please enable it in Settings" without a button
 *    that goes there is a dead end.
 *
 * Resolves `true` only once the permission is actually granted. Never throws.
 */
export async function askWithReason(ask: AskWithReason): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const current = await ask.check().catch(() => null);
  if (!current) return false;
  if (current.granted) return true;

  if (!current.canAskAgain) {
    if (ask.blocked) offerSettings(ask.blocked);
    return false;
  }

  const agreed = await new Promise<boolean>((resolve) => {
    Alert.alert(
      ask.title,
      ask.reason,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: ask.allowLabel, onPress: () => resolve(true) },
      ],
      // Android back-button / tap-outside counts as "not now", not as a hang.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
  if (!agreed) return false;

  const result = await ask.request().catch(() => null);
  return Boolean(result?.granted);
}

/** "It's switched off — here's the way back." */
export function offerSettings({ title, body }: { title: string; body: string }) {
  Alert.alert(title, body, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => void Linking.openSettings().catch(() => {}) },
  ]);
}
