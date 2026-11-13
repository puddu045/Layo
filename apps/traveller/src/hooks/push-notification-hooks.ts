import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api-client';

// Without this, Android/iOS silently drop a notification that arrives while the app is in the
// foreground — this app wants it shown even then, for whichever conversation *isn't* the one
// currently open (the one that is never gets this far: see `isUserActiveInChat` server-side).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers this device for push notifications once signed in, and unregisters it again on
 * sign-out (or if a different account signs in on the same device) — mount once near the app's
 * root (`_layout.tsx`), not per-screen, since a device's push token isn't tied to any one
 * screen. Also handles tapping a notification (app backgrounded or fully closed) by deep-linking
 * into the conversation it was about.
 */
export function usePushNotifications() {
  const { session } = useAuth();
  const registeredTokenRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // No device push on web, and simulators/emulators can't receive real push either.
    if (Platform.OS === 'web' || !session || !Device.isDevice) return;

    let cancelled = false;

    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let status = existingStatus;
      if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted' || cancelled) return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (cancelled) return;

      registeredTokenRef.current = token;
      await api.post('/push-tokens', { token, platform: Platform.OS }).catch(() => {});
    })();

    return () => {
      cancelled = true;
      const token = registeredTokenRef.current;
      if (token) {
        registeredTokenRef.current = undefined;
        api.delete('/push-tokens', { token }).catch(() => {});
      }
    };
  }, [session]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const connectionId = response.notification.request.content.data?.connectionId;
      if (typeof connectionId === 'string') {
        router.push(`/chat/${connectionId}`);
      }
    });
    return () => subscription.remove();
  }, []);
}
