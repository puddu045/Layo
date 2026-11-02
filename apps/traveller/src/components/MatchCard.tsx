import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@layo/contracts';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { notifyInfo } from '../lib/notify';
import { Card } from './Card';
import { Chip } from './Chip';
import { Button } from './Button';

const CATEGORY_LABEL: Record<Match['category'], string> = {
  SAME_FLIGHT: 'Same flight',
  SAME_DEPARTURE_AIRPORT: 'Same departure airport',
  SAME_LAYOVER_AIRPORT: 'Same layover',
};

const CATEGORY_ICON: Record<Match['category'], keyof typeof Ionicons.glyphMap> = {
  SAME_FLIGHT: 'airplane-outline',
  SAME_DEPARTURE_AIRPORT: 'location-outline',
  SAME_LAYOVER_AIRPORT: 'swap-horizontal-outline',
};

const DISCLAIMER = "Meeting up in person isn't confirmed — terminal/airside access isn't guaranteed.";

function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function MatchCard({ match, onConnect }: { match: Match; onConnect: () => void }) {
  const initial = match.profile.displayName.charAt(0).toUpperCase();
  const connectIcon = match.connectionStatus === 'NONE' ? 'person-add-outline' : undefined;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        {match.profile.photoUrl ? (
          <Image source={{ uri: match.profile.photoUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {match.profile.displayName}
            {match.profile.age ? `, ${match.profile.age}` : ''}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name={CATEGORY_ICON[match.category]} size={13} color={colors.primary} />
            <Text style={styles.meta}>{CATEGORY_LABEL[match.category]}</Text>
          </View>
        </View>
      </View>

      {match.profile.bio ? <Text style={styles.bio}>{match.profile.bio}</Text> : null}

      {match.profile.interests.length > 0 && (
        <View style={styles.chipRow}>
          {match.profile.interests.slice(0, 4).map((interest) => (
            <Chip key={interest} label={interest} />
          ))}
        </View>
      )}

      <View style={styles.windowRow}>
        <Text style={styles.windowLabel}>
          {match.airportIata ?? ''} {formatWindow(match.overlapStartUtc, match.overlapEndUtc)}
        </Text>
        <Pressable
          hitSlop={8}
          onPress={() => notifyInfo('Meeting up', DISCLAIMER)}
          accessibilityRole="button"
          accessibilityLabel="More info about meeting up"
          accessibilityHint={DISCLAIMER}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Button
        label={
          match.connectionStatus === 'ACCEPTED'
            ? 'Connected'
            : match.connectionStatus === 'PENDING_SENT'
              ? 'Request sent'
              : match.connectionStatus === 'PENDING_RECEIVED'
                ? 'Respond to request'
                : 'Connect'
        }
        icon={connectIcon}
        onPress={onConnect}
        variant={match.connectionStatus === 'NONE' ? 'primary' : 'secondary'}
        disabled={
          match.connectionStatus === 'ACCEPTED' || match.connectionStatus === 'PENDING_SENT'
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarImage: { width: 48, height: 48, borderRadius: radius.pill, marginRight: spacing.sm },
  avatarText: { color: colors.white, ...typography.subtitle },
  name: { ...typography.subtitle, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  meta: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  bio: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  windowLabel: { ...typography.label, color: colors.navy700 },
});
