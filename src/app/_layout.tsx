import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Brand, Colors } from '@/constants/theme';
import { listenForNotificationTaps, registerForPush } from '@/lib/notifications';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { ready, userId, profile } = useSession();
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const segments = useSegments();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Signed-out users always start on the welcome screen (not directly on sign-in).
  useEffect(() => {
    const first = segments[0] as string | undefined;
    if (ready && !userId && first !== 'auth' && first !== 'sign-in' && first !== 'legal') {
      router.replace('/auth');
    }
  }, [ready, userId, segments]);

  useEffect(() => {
    if (!profile) return;
    registerForPush();
    return listenForNotificationTaps();
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null;
  const signedIn = !!userId;
  const onboarded = !!profile;

  return (
    <Stack screenOptions={{ headerTintColor: Brand.primary, contentStyle: { backgroundColor: c.background }, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Anmelden', headerTransparent: true, headerTitle: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[id]" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
        <Stack.Screen name="match/[id]" options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Profil bearbeiten', presentation: 'modal' }} />
        <Stack.Screen name="filters" options={{ title: 'Filter', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
        <Stack.Screen name="report/[id]" options={{ title: 'Melden', presentation: 'modal' }} />
        <Stack.Screen name="premium" options={{ presentation: 'modal', headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, primary: Brand.primary } }}>
        <SessionProvider>
          <RootStack />
        </SessionProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
