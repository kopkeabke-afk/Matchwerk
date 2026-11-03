import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { backend } from './index';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ask for permission and store the Expo push token (server sends via supabase/functions/push). */
export async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web' || backend.mode !== 'supabase') return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Nachrichten & Matches',
        // eslint-disable-next-line import/namespace -- enum is re-exported, plugin can't see it
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await backend.savePushToken(data);
  } catch (e) {
    console.warn('Push registration failed', e);
  }
}

/** Open the right screen when a notification is tapped. */
export function listenForNotificationTaps(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string') router.push(url as never);
  });
  return () => sub.remove();
}
