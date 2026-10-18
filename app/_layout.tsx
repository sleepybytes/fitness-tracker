import * as Notifications from 'expo-notifications';
import { DarkTheme, Stack, ThemeProvider, router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import 'react-native-reanimated';

import { ensurePermission, syncNotifications } from '@/src/lib/notifications';
import { useTracker } from '@/src/store/useTracker';
import { theme as t } from '@/src/theme';

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: t.accent, background: t.bg, card: t.card, text: t.text, border: t.border },
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

/** Keep scheduled reminders in step with what has been logged and with settings. */
function useReminderSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const { logs, settings } = useTracker.getState();
      syncNotifications(logs, settings).catch((e) => console.warn('Reminder sync failed', e));
    };
    const runSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 1500);
    };
    const start = () => {
      ensurePermission().finally(run);
    };

    const unsubHydration = useTracker.persist.hasHydrated() ? (start(), () => {}) : useTracker.persist.onFinishHydration(start);
    const unsubStore = useTracker.subscribe((s, prev) => {
      if (useTracker.persist.hasHydrated() && (s.logs !== prev.logs || s.settings !== prev.settings)) runSoon();
    });
    const appState = AppState.addEventListener('change', (st) => st === 'active' && run());

    return () => {
      clearTimeout(timer);
      unsubHydration();
      unsubStore();
      appState.remove();
    };
  }, []);
}

/** Open the screen a tapped notification points at. */
function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') router.navigate(url as Href);
  }, [response]);
}

/** Notifications are native-only; the web preview renders without them. */
function NotificationBridge() {
  useReminderSync();
  useNotificationRouting();
  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      {Platform.OS !== 'web' ? <NotificationBridge /> : null}
      <StatusBar style="light" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
