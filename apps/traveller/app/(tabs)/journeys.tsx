import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { JourneyCard } from '../../src/components/JourneyCard';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useJourneys } from '../../src/hooks/api-hooks';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function Journeys() {
  const journeys = useJourneys();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Journeys</Text>
        <Pressable onPress={() => router.push('/journeys/new')} hitSlop={8} style={styles.addButton}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {journeys.isLoading ? (
        <LoadingState label="Loading your journeys…" />
      ) : journeys.isError ? (
        <ErrorState
          message={journeys.error instanceof Error ? journeys.error.message : 'Could not load journeys'}
          onRetry={() => journeys.refetch()}
        />
      ) : journeys.data && journeys.data.length > 0 ? (
        <FlatList
          data={journeys.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <JourneyCard journey={item} onPress={() => router.push(`/journeys/${item.id}`)} />}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          onRefresh={() => journeys.refetch()}
          refreshing={journeys.isFetching}
        />
      ) : (
        <EmptyState
          title="No journeys yet"
          description="Add your first flight to start building a journey and see who else is travelling alongside you."
          actionLabel="Add a flight"
          onAction={() => router.push('/journeys/new')}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { ...typography.display, color: colors.navy900 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
