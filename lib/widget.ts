import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';

const APP_GROUP = 'group.com.lunara.app.widget';

const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

/** Push the latest streak snapshot to the iOS home screen widget. No-ops off iOS. */
export function updateWidgetData(data: { streak: number; ritualComplete: boolean; isPaired: boolean }): void {
  if (!storage) return;
  storage.set('streak', data.streak);
  storage.set('ritualComplete', data.ritualComplete ? 1 : 0);
  storage.set('isPaired', data.isPaired ? 1 : 0);
  ExtensionStorage.reloadWidget();
}
