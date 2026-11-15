import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../src/theme/tokens';
import { useConnectionsUnreadCount } from '../../src/hooks/chat-hooks';

type IconName = keyof typeof Ionicons.glyphMap;

/** One theme colour for every tab's active state — the filled icon sits on a soft tinted pill in
 * `colors.accent`, matching the active label colour below, instead of a different hue per tab. */
function tabIcon(outlineName: IconName, filledName: IconName) {
  return ({ focused, size }: { focused: boolean; color: unknown; size: number }) => (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={focused ? filledName : outlineName} color={focused ? colors.accent : colors.textSecondary} size={size} />
    </View>
  );
}

export default function TabsLayout() {
  const unreadMessages = useConnectionsUnreadCount();
  const unreadBadge = unreadMessages.data ? (unreadMessages.data > 99 ? '99+' : String(unreadMessages.data)) : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: tabIcon('compass-outline', 'compass'),
        }}
      />
      <Tabs.Screen
        name="journeys"
        options={{
          title: 'Journeys',
          tabBarIcon: tabIcon('airplane-outline', 'airplane'),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: tabIcon('chatbubble-outline', 'chatbubble'),
          tabBarBadge: unreadBadge,
        }}
      />
      <Tabs.Screen
        name="airport-hub"
        options={{
          title: 'Airport Hub',
          tabBarIcon: tabIcon('business-outline', 'business'),
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: 'Deals',
          tabBarIcon: tabIcon('pricetag-outline', 'pricetag'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryTint,
  },
});
