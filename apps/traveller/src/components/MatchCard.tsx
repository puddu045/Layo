import { StyleSheet, Text, View } from 'react-native';
import type { Match } from '@layo/contracts';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { Card } from './Card';
import { Chip } from './Chip';
import { Button } from './Button';

const CATEGORY_LABEL: Record<Match['category'], string> = {
  SAME_FLIGHT: 'Same flight',
  SAME_DEPARTURE_AIRPORT: 'Same departure airport',
  SAME_LAYOVER_AIRPORT: 'Same layover',
};

function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function MatchCard({ match, onConnect }: { match: Match; onConnect: () => void }) {
  const initial = match.profile.displayName.charAt(0).toUpperCase();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {match.profile.displayName}
            {match.profile.age ? `, ${match.profile.age}` : ''}
          </Text>
          <Text style={styles.meta}>{CATEGORY_LABEL[match.category]}</Text>
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
      </View>

      <Text style={styles.disclaimer}>
        Meeting up in person isn&apos;t confirmed — terminal/airside access isn&apos;t guaranteed.
      </Text>

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
        onPress={onConnect}
        variant={match.connectionStatus === 'NONE' ? 'primary' : 'secondary'}
        disabled={match.connectionStatus === 'ACCEPTED' || match.connectionStatus === 'PENDING_SENT'}
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
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: { color: colors.white, ...typography.subtitle },
  name: { ...typography.subtitle, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.teal500, fontWeight: '600' },
  bio: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  windowRow: { marginBottom: spacing.xs },
  windowLabel: { ...typography.label, color: colors.navy700 },
  disclaimer: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
});
