import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { AirportRoomSummary } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Card } from '../../src/components/Card';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useMyAirportRooms } from '../../src/hooks/airport-room-hooks';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

function formatWindow(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AirportHub() {
  const rooms = useMyAirportRooms();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Airport Hub</Text>
      </View>

      {rooms.isLoading ? (
        <LoadingState label="Finding your airport rooms…" />
      ) : rooms.isError ? (
        <ErrorState
          message={rooms.error instanceof Error ? rooms.error.message : 'Could not load airport rooms'}
          onRetry={() => rooms.refetch()}
        />
      ) : !rooms.data || rooms.data.length === 0 ? (
        <EmptyState
          title="No airport rooms yet"
          description="Add a journey and its departure/layover airports will show up here — you can chat once you're within the access window."
          actionLabel="Add a flight"
          onAction={() => router.push('/journeys/new')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {rooms.data.map((room) => (
            <RoomCard key={room.airportIata} room={room} />
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function RoomCard({ room }: { room: AirportRoomSummary }) {
  const content = (
    <Card style={[styles.card, !room.eligible && styles.cardDisabled]}>
      <View style={styles.cardTop}>
        <View style={styles.iataBadge}>
          <Text style={styles.iataText}>{room.airportIata}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{room.name}</Text>
          <Text style={styles.participants}>
            {room.participantCount} traveller{room.participantCount === 1 ? '' : 's'} have joined
          </Text>
        </View>
        {room.eligible ? (
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        ) : (
          <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
        )}
      </View>
      <Text style={styles.statusText}>
        {room.eligible
          ? 'Open now — read and chat'
          : room.accessWindowStartUtc
            ? `Opens ${formatWindow(room.accessWindowStartUtc)}`
            : 'Not currently available'}
      </Text>
    </Card>
  );

  if (!room.eligible) return content;

  return (
    <Pressable onPress={() => router.push(`/airport-room/${room.airportIata}`)} android_ripple={{ color: colors.border }}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.display, color: colors.navy900 },
  card: { marginBottom: spacing.md },
  cardDisabled: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iataBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iataText: { ...typography.label, color: colors.navy700 },
  name: { ...typography.subtitle, color: colors.textPrimary },
  participants: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusText: { ...typography.caption, color: colors.teal500, fontWeight: '600', marginTop: spacing.sm },
});
