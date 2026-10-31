import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Deal } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Card } from '../../src/components/Card';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useMyDeals } from '../../src/hooks/deal-hooks';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const CATEGORY_LABELS: Record<string, string> = {
  FOOD_DRINK: 'Food & drink',
  DUTY_FREE: 'Duty free',
  LOUNGE: 'Lounge',
  FASHION_RETAIL: 'Fashion & retail',
  TRAVEL_ESSENTIALS: 'Travel essentials',
  SERVICES: 'Services',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function groupByAirport(deals: Deal[]): Array<[string, Deal[]]> {
  const groups = new Map<string, Deal[]>();
  for (const deal of deals) {
    groups.set(deal.airportIata, [...(groups.get(deal.airportIata) ?? []), deal]);
  }
  return [...groups.entries()];
}

export default function Deals() {
  const deals = useMyDeals();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Deals</Text>
      </View>

      {deals.isLoading ? (
        <LoadingState label="Finding deals at your airports…" />
      ) : deals.isError ? (
        <ErrorState
          message={deals.error instanceof Error ? deals.error.message : 'Could not load deals'}
          onRetry={() => deals.refetch()}
        />
      ) : !deals.data || deals.data.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Add a journey and offers at its airports will show up here."
          actionLabel="Add a flight"
          onAction={() => router.push('/journeys/new')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {groupByAirport(deals.data).map(([airportIata, airportDeals]) => (
            <View key={airportIata} style={styles.group}>
              <Text style={styles.groupTitle}>{airportIata}</Text>
              {airportDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.dealTitle}>{deal.title}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[deal.category] ?? deal.category}</Text>
        </View>
      </View>
      <Text style={styles.businessName}>
        {deal.businessName}
        {deal.terminal ? ` · Terminal ${deal.terminal}` : ''}
      </Text>
      <Text style={styles.description}>{deal.description}</Text>
      {deal.promoCode ? (
        <View style={styles.promoRow}>
          <Text style={styles.promoLabel}>Promo code</Text>
          <Text style={styles.promoCode}>{deal.promoCode}</Text>
        </View>
      ) : null}
      <Text style={styles.validity}>
        Valid {formatDate(deal.validFrom)} – {formatDate(deal.validUntil)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.display, color: colors.navy900 },
  group: { marginBottom: spacing.lg },
  groupTitle: { ...typography.label, color: colors.navy700, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  dealTitle: { ...typography.subtitle, color: colors.textPrimary, flex: 1 },
  categoryBadge: {
    backgroundColor: colors.teal100,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categoryText: { ...typography.caption, color: colors.navy700, fontWeight: '600' },
  businessName: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  description: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  promoLabel: { ...typography.caption, color: colors.textSecondary },
  promoCode: { ...typography.label, color: colors.teal500, fontWeight: '700' },
  validity: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
