import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useFonts } from 'expo-font';
// Display + numerals + the couple's own writing. Fraunces carries real optical
// sizing, so it holds together at 13px as well as at 40. See constants/typography.ts.
import {
  Fraunces_400Regular,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
// Every control, label and piece of chrome.
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Notifications from 'expo-notifications';
import { AppProvider } from '@/context/AppContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    /**
     * Where a tapped notification lands. "Ready to reveal" is the one push in
     * the app with a payoff waiting behind it, so it opens the reveal directly
     * rather than the tab it lives on — a notification that costs an extra tap
     * to cash in is a notification people stop opening.
     *
     * Tonight is pushed underneath it either way, so closing the reveal lands
     * somewhere sensible instead of on an empty stack.
     */
    const route = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      if (data.screen !== 'tonight' && data.screen !== 'reveal') return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push('/(app)/' as any);
      if (data.screen === 'reveal') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push('/reveal' as any);
      }
    };

    // Handle notification tap while the app is running
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      route(response.notification.request.content.data as Record<string, unknown> | undefined);
    });

    // Also check if the app was opened from a notification that was already dismissed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      route(response.notification.request.content.data as Record<string, unknown> | undefined);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen
        name="reveal"
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="(modals)"
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen
        name="keepsakes"
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen name="moment/[date]" options={{ animation: 'slide_from_right' }} />
      {/* Deep-link targets: the widget's lunara://tonight and the invite link's
          lunara://join/<code>. Both redirect rather than render. */}
      <Stack.Screen name="tonight" />
      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#0A0817');
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0817' }}>
            <KeyboardProvider>
              <AppProvider>
                <RootLayoutNav />
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
