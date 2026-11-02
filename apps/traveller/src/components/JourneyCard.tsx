import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Journey } from '@layo/contracts';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { Card } from './Card';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Derived from the journey's own flight times — no separate status field exists, so "upcoming"
 * vs "completed" is simply whether the last segment has already landed. */
function journeyStatus(journey: Journey): { label: string; color: string } {
  const last = journey.segments[journey.segments.length - 1];
  const hasLanded = last && new Date(last.flight.scheduledArrivalUtc) < new Date();
  return hasLanded ? { label: 'Completed', color: colors.textSecondary } : { label: 'Upcoming', color: colors.success };
}

export function JourneyCard({ journey, onPress }: { journey: Journey; onPress: () => void }) {
  const first = journey.segments[0];
  const last = journey.segments[journey.segments.length - 1];
  const status = journeyStatus(journey);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.routeRow}>
          <Ionicons name="airplane" size={18} color={colors.primary} style={styles.routeIcon} />
          <Text style={styles.route}>
            {first?.flight.departureAirport.iataCode} → {last?.flight.arrivalAirport.iataCode}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color === colors.success ? colors.primaryTint : colors.background }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        {!journey.isDiscoverable && <Text style={styles.hiddenBadge}>Hidden from Discover</Text>}

        {journey.segments.map((segment, index) => (
          <View key={segment.id} style={styles.segmentRow}>
            {index > 0 && <View style={styles.connector} />}
            <View style={styles.segmentTop}>
              <Text style={styles.segmentFlight}>
                {segment.flight.airline.iataCode}
                {segment.flight.flightNumber.replace(/^[A-Z]{2}/, '')} ·{' '}
                {segment.flight.departureAirport.iataCode} → {segment.flight.arrivalAirport.iataCode}
              </Text>
              <Ionicons
                name={segment.flight.verified ? 'checkmark-circle' : 'alert-circle-outline'}
                size={14}
                color={segment.flight.verified ? colors.success : colors.warning}
              />
            </View>
            <Text style={styles.segmentTime}>
              {formatDateTime(segment.flight.scheduledDepartureUtc)}
            </Text>
            {!segment.flight.verified && <Text style={styles.unverified}>Unverified schedule</Text>}
          </View>
        ))}
        {journey.layovers.map((layover) => (
          <Text key={`${layover.airportIata}-${layover.arrivalUtc}`} style={styles.layover}>
            Layover at {layover.airportIata}: {Math.floor(layover.durationMinutes / 60)}h{' '}
            {layover.durationMinutes % 60}m
          </Text>
        ))}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  routeIcon: { marginRight: spacing.xs },
  route: { ...typography.title, color: colors.textPrimary, flex: 1 },
  statusBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { ...typography.caption, fontWeight: '700' },
  hiddenBadge: { ...typography.caption, color: colors.warning, marginBottom: spacing.sm },
  segmentRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  connector: {
    width: 2,
    height: spacing.sm,
    backgroundColor: colors.primaryLight,
    marginLeft: 2,
    marginBottom: 2,
  },
  segmentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segmentFlight: { ...typography.body, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  segmentTime: { ...typography.caption, color: colors.textSecondary },
  unverified: { ...typography.caption, color: colors.warning, marginTop: 2 },
  layover: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
});
