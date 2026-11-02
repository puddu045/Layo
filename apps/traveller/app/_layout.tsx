import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { queryClient } from '../src/lib/query-client';
import { AuthProvider, useAuth } from '../src/lib/auth-context';
import { colors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * The root `/` route (index.tsx) already redirects to welcome when there's no session, but that
 * only runs when you land there. If a session dies later — API calls start 401ing (see
 * api-client.ts) and sign out — while you're already on some other screen, nothing was sending
 * you back to a login screen; every screen just showed its own dead-end "could not load" error.
 * This mirrors index.tsx's redirect for every other route instead of only the first one.
 */
function SessionGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Empty segments is the root `/` route, which handles its own redirect; leave it alone here
    // to avoid a second, racing one. Cast away expo-router's generated tuple type, which (per the
    // app's current routes) doesn't account for that empty-array case at the type level.
    if ((segments as string[]).length === 0) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    }
  }, [session, loading, segments, router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionGuard />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen
            name="profile-setup"
            options={{ headerShown: true, title: 'Set up your profile', gestureEnabled: false }}
          />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="journeys/new" options={{ headerShown: true, title: 'Add a flight' }} />
          <Stack.Screen name="journeys/[id]" options={{ headerShown: true, title: 'Journey details' }} />
          <Stack.Screen name="chat/[connectionId]" options={{ headerShown: true, title: 'Chat' }} />
          <Stack.Screen name="airport-room/[iata]" options={{ headerShown: true, title: 'Airport Chat' }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
