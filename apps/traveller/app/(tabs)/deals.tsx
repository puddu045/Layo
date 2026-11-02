import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type { Deal } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useMyDeals } from '../../src/hooks/deal-hooks';
import { notifyInfo } from '../../src/lib/notify';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const CATEGORY_LABELS: Record<string, string> = {
  FOOD_DRINK: 'Food & drink',
  DUTY_FREE: 'Duty free',
  LOUNGE: 'Lounge',
  FASHION_RETAIL: 'Fashion & retail',
  TRAVEL_ESSENTIALS: 'Travel essentials',
  SERVICES: 'Services',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  FOOD_DRINK: 'cafe-outline',
  DUTY_FREE: 'bag-handle-outline',
  LOUNGE: 'wine-outline',
  FASHION_RETAIL: 'shirt-outline',
  TRAVEL_ESSENTIALS: 'briefcase-outline',
  SERVICES: 'construct-outline',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export default function Deals() {
  const deals = useMyDeals();
  const [airportFilter, setAirportFilter] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const airports = useMemo(
    () => [...new Set((deals.data ?? []).map((d) => d.airportIata))],
    [deals.data],
  );
  const categories = useMemo(
    () => [...new Set((deals.data ?? []).map((d) => d.category))],
    [deals.data],
  );

  const filtered = useMemo(
    () =>
      (deals.data ?? []).filter(
        (d) => (!airportFilter || d.airportIata === airportFilter) && (!categoryFilter || d.category === categoryFilter),
      ),
    [deals.data, airportFilter, categoryFilter],
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Deals</Text>
        <Text style={styles.subtitle}>Exclusive offers at your airports</Text>
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
        <>
          {airports.length > 1 && (
            <View style={styles.filterRow}>
              <Chip label="All airports" selected={!airportFilter} onPress={() => setAirportFilter(undefined)} />
              {airports.map((a) => (
                <Chip key={a} label={a} selected={airportFilter === a} onPress={() => setAirportFilter(a)} />
              ))}
            </View>
          )}
          {categories.length > 1 && (
            <View style={styles.filterRow}>
              <Chip label="All" selected={!categoryFilter} onPress={() => setCategoryFilter(undefined)} />
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={CATEGORY_LABELS[c] ?? c}
                  icon={CATEGORY_ICONS[c]}
                  selected={categoryFilter === c}
                  onPress={() => setCategoryFilter(c)}
                />
              ))}
            </View>
          )}

          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No deals match these filters.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.xs }}>
              {filtered.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const onCopyPromo = async () => {
    if (!deal.promoCode) return;
    await Clipboard.setStringAsync(deal.promoCode);
    notifyInfo('Copied', `Promo code ${deal.promoCode} copied.`);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconTile}>
          <Ionicons name={CATEGORY_ICONS[deal.category] ?? 'pricetag-outline'} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.dealTitle}>{deal.title}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{CATEGORY_LABELS[deal.category] ?? deal.category}</Text>
            </View>
          </View>
          <Text style={styles.businessName}>
            {deal.businessName}
            {deal.terminal ? ` · Terminal ${deal.terminal}` : ''} · {deal.airportIata}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>{deal.description}</Text>

      {deal.promoCode ? (
        <Pressable onPress={onCopyPromo} style={styles.promoRow}>
          <Text style={styles.promoLabel}>Promo code</Text>
          <Text style={styles.promoCode}>{deal.promoCode}</Text>
          <Ionicons name="copy-outline" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
      <Text style={styles.validity}>
        Valid {formatDate(deal.validFrom)} – {formatDate(deal.validUntil)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.display, color: colors.primaryDark },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', gap: spacing.sm },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  dealTitle: { ...typography.subtitle, color: colors.textPrimary, flex: 1 },
  categoryBadge: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categoryText: { ...typography.caption, color: colors.navy700, fontWeight: '600' },
  businessName: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  description: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  promoLabel: { ...typography.caption, color: colors.textSecondary },
  promoCode: { ...typography.label, color: colors.primary, fontWeight: '700' },
  validity: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
