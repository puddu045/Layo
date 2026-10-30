import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useDeleteJourney, useJourney } from '../../src/hooks/api-hooks';
import { notifyConfirm, notifyInfo } from '../../src/lib/notify';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function JourneyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const journey = useJourney(id);
  const deleteJourney = useDeleteJourney();
  const [deleting, setDeleting] = useState(false);

  if (journey.isLoading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading journey…" />
      </ScreenContainer>
    );
  }

  if (journey.isError || !journey.data) {
    return (
      <ScreenContainer>
        <ErrorState
          message={journey.error instanceof Error ? journey.error.message : 'Could not load this journey'}
          onRetry={() => journey.refetch()}
        />
      </ScreenContainer>
    );
  }

  const data = journey.data;

  const onDelete = () => {
    notifyConfirm(
      'Remove journey',
      'This will remove the journey and all its flights from your account.',
      async () => {
        setDeleting(true);
        try {
          await deleteJourney.mutateAsync(data.id);
          router.replace('/(tabs)/journeys');
        } catch (err) {
          notifyInfo('Error', err instanceof Error ? err.message : 'Could not remove journey');
        } finally {
          setDeleting(false);
        }
      },
      { confirmLabel: 'Remove', destructive: true },
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>
          {data.segments[0]?.flight.departureAirport.iataCode} →{' '}
          {data.segments[data.segments.length - 1]?.flight.arrivalAirport.iataCode}
        </Text>

        {data.segments.map((segment, index) => (
          <Card key={segment.id} style={styles.segmentCard}>
            <Text style={styles.segmentLabel}>Flight {index + 1}</Text>
            <Text style={styles.flightNumber}>
              {segment.flight.airline.name} {segment.flight.flightNumber}
            </Text>
            <Text style={styles.route}>
              {segment.flight.departureAirport.name} ({segment.flight.departureAirport.iataCode})
              {segment.flight.departureTerminal ? ` · Terminal ${segment.flight.departureTerminal}` : ''}
            </Text>
            <Text style={styles.time}>{formatDateTime(segment.flight.scheduledDepartureUtc)}</Text>
            <Text style={styles.arrow}>↓</Text>
            <Text style={styles.route}>
              {segment.flight.arrivalAirport.name} ({segment.flight.arrivalAirport.iataCode})
              {segment.flight.arrivalTerminal ? ` · Terminal ${segment.flight.arrivalTerminal}` : ''}
            </Text>
            <Text style={styles.time}>{formatDateTime(segment.flight.scheduledArrivalUtc)}</Text>
            {!segment.flight.verified && (
              <Text style={styles.unverifiedBadge}>
                {segment.flight.dataSource === 'MOCK' ? 'Demo data — not a real schedule' : 'Unverified manual entry'}
              </Text>
            )}
          </Card>
        ))}

        {data.layovers.length > 0 && (
          <Card style={styles.layoverCard}>
            <Text style={styles.segmentLabel}>Layovers</Text>
            {data.layovers.map((layover) => (
              <Text key={`${layover.airportIata}-${layover.arrivalUtc}`} style={styles.layoverText}>
                {layover.airportIata}: {Math.floor(layover.durationMinutes / 60)}h {layover.durationMinutes % 60}m (
                {formatDateTime(layover.arrivalUtc)} → {formatDateTime(layover.departureUtc)})
              </Text>
            ))}
          </Card>
        )}

        <Button label="Remove journey" variant="danger" onPress={onDelete} loading={deleting} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { ...typography.display, color: colors.navy900, marginBottom: spacing.sm },
  segmentCard: { marginBottom: spacing.md },
  segmentLabel: { ...typography.label, color: colors.teal500, marginBottom: spacing.xs },
  flightNumber: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  route: { ...typography.body, color: colors.textPrimary },
  time: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  arrow: { ...typography.body, color: colors.border, textAlign: 'center' },
  unverifiedBadge: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.xs,
    backgroundColor: '#FBF0DC',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  layoverCard: { marginBottom: spacing.md },
  layoverText: { ...typography.body, color: colors.navy700, marginBottom: spacing.xs },
});
