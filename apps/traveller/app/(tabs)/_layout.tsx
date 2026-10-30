import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

// React Navigation's tabBarIcon color type is an opaque platform color value;
// Ionicons only accepts a string, so fall back when it isn't one.
function tabIcon(name: IconName) {
  return ({ color, size }: { color: unknown; size: number }) => (
    <Ionicons name={name} color={typeof color === 'string' ? color : colors.textSecondary} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy900,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: tabIcon('compass-outline'),
        }}
      />
      <Tabs.Screen
        name="journeys"
        options={{
          title: 'Journeys',
          tabBarIcon: tabIcon('airplane-outline'),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: tabIcon('chatbubble-outline'),
        }}
      />
      <Tabs.Screen
        name="airport-hub"
        options={{
          title: 'Airport Hub',
          tabBarIcon: tabIcon('business-outline'),
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: 'Deals',
          tabBarIcon: tabIcon('pricetag-outline'),
        }}
      />
    </Tabs>
  );
}
