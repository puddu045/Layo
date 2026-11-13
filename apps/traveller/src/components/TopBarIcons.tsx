import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { useOwnProfile } from '../hooks/api-hooks';
import { useUnreadNotificationsCount } from '../hooks/notification-hooks';
import { colors, spacing } from '../theme/tokens';

/**
 * The bell + profile-picture pair shown in every tab's own header — tapping the bell opens
 * Notifications, tapping the avatar opens Settings (this replaced a plain gear icon there, so
 * every screen shows who's signed in, not just an anonymous settings glyph). Each tab mounts
 * this itself alongside its own title row, the same way Discover already did for just the bell.
 */
export function TopBarIcons() {
  const profile = useOwnProfile();
  const unreadCount = useUnreadNotificationsCount();

  return (
    <View style={styles.row}>
      <Link href="/notifications" asChild>
        <Pressable hitSlop={8} style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color={colors.navy900} />
          {!!unreadCount.data && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount.data > 9 ? '9+' : unreadCount.data}</Text>
            </View>
          )}
        </Pressable>
      </Link>
      <Link href="/settings" asChild>
        <Pressable hitSlop={8}>
          <Avatar photoUrl={profile.data?.photoUrl} displayName={profile.data?.displayName ?? ''} size={30} />
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconButton: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
