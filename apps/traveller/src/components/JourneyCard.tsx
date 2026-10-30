import { Pressable, StyleSheet, Text, View } from 'react-native';
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

export function JourneyCard({ journey, onPress }: { journey: Journey; onPress: () => void }) {
  const first = journey.segments[0];
  const last = journey.segments[journey.segments.length - 1];

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <Text style={styles.route}>
          {first?.flight.departureAirport.iataCode} → {last?.flight.arrivalAirport.iataCode}
        </Text>
        {!journey.isDiscoverable && <Text style={styles.hiddenBadge}>Hidden from Discover</Text>}
        {journey.segments.map((segment) => (
          <View key={segment.id} style={styles.segmentRow}>
            <Text style={styles.segmentFlight}>
              {segment.flight.airline.iataCode}{segment.flight.flightNumber.replace(/^[A-Z]{2}/, '')} ·{' '}
              {segment.flight.departureAirport.iataCode} → {segment.flight.arrivalAirport.iataCode}
            </Text>
            <Text style={styles.segmentTime}>{formatDateTime(segment.flight.scheduledDepartureUtc)}</Text>
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
  route: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
  hiddenBadge: { ...typography.caption, color: colors.warning, marginBottom: spacing.sm },
  segmentRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  segmentFlight: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  segmentTime: { ...typography.caption, color: colors.textSecondary },
  unverified: { ...typography.caption, color: colors.warning, marginTop: 2 },
  layover: {
    ...typography.caption,
    color: colors.teal500,
    fontWeight: '600',
    marginTop: spacing.xs,
    backgroundColor: colors.teal100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
});
