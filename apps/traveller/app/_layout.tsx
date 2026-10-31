import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_700Bold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import { queryClient } from '../src/lib/query-client';
import { AuthProvider } from '../src/lib/auth-context';
import { colors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Poppins_700Bold, Poppins_800ExtraBold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
