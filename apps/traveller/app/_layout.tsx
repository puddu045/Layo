import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../src/lib/query-client';
import { AuthProvider } from '../src/lib/auth-context';
import { colors } from '../src/theme/tokens';

export default function RootLayout() {
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
