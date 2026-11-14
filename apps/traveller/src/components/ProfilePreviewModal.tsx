import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@layo/contracts';
import { Avatar } from './Avatar';
import { Chip } from './Chip';
import { Button } from './Button';
import { LoadingState } from './StateViews';
import { usePublicProfile, useMatchContext } from '../hooks/api-hooks';
import { colors, radius, spacing, typography } from '../theme/tokens';

const CATEGORY_ICON: Record<Match['category'], keyof typeof Ionicons.glyphMap> = {
  SAME_FLIGHT: 'airplane-outline',
  SAME_DEPARTURE_AIRPORT: 'location-outline',
  SAME_LAYOVER_AIRPORT: 'swap-horizontal-outline',
};

function describeMatch(match: Match): string {
  if (match.category === 'SAME_FLIGHT') return `Same flight${match.flightNumber ? ` · ${match.flightNumber}` : ''}`;
  if (match.category === 'SAME_DEPARTURE_AIRPORT') return `Same departure airport${match.airportIata ? ` · ${match.airportIata}` : ''}`;
  return `Same layover${match.airportIata ? ` · ${match.airportIata}` : ''}`;
}

interface ProfilePreviewModalProps {
  userId: string | undefined;
  onClose: () => void;
}

/** The popup behind tapping a name or photo anywhere in the app — their photo, name, a few
 * profile details, and (for someone already connected) how the two of you are currently
 * connected. Visible exactly when `userId` is set; the caller just needs one piece of state. */
export function ProfilePreviewModal({ userId, onClose }: ProfilePreviewModalProps) {
  const profile = usePublicProfile(userId);
  const matchContext = useMatchContext(userId);

  return (
    <Modal visible={!!userId} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows the tap so it doesn't bubble to the backdrop and close the sheet. */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {profile.isLoading ? (
              <LoadingState label="Loading profile…" />
            ) : profile.isError || !profile.data ? (
              <Text style={styles.error}>Could not load this profile.</Text>
            ) : (
              <>
                <Avatar photoUrl={profile.data.photoUrl} displayName={profile.data.displayName} size={120} />
                <Text style={styles.name}>
                  {profile.data.displayName}
                  {profile.data.age ? `, ${profile.data.age}` : ''}
                </Text>
                {profile.data.homeCityIata ? (
                  <View style={styles.homeRow}>
                    <Ionicons name="home-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.homeText}>Based near {profile.data.homeCityIata}</Text>
                  </View>
                ) : null}

                {profile.data.bio ? <Text style={styles.bio}>{profile.data.bio}</Text> : null}

                {profile.data.interests.length > 0 && (
                  <View style={styles.chipRow}>
                    {profile.data.interests.map((interest) => (
                      <Chip key={interest} label={interest} />
                    ))}
                  </View>
                )}

                <Text style={styles.sectionLabel}>How you're connected</Text>
                {matchContext.isLoading ? (
                  <Text style={styles.connectionHint}>Checking…</Text>
                ) : matchContext.data && matchContext.data.length > 0 ? (
                  matchContext.data.map((match, i) => (
                    <View key={`${match.category}-${i}`} style={styles.connectionRow}>
                      <Ionicons name={CATEGORY_ICON[match.category]} size={15} color={colors.primary} />
                      <Text style={styles.connectionText}>{describeMatch(match)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.connectionHint}>You're connected on Layo.</Text>
                )}
              </>
            )}

            <Button label="Close" variant="ghost" onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 54, 93, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  content: { alignItems: 'center', paddingBottom: spacing.sm },
  error: { ...typography.body, color: colors.danger, marginVertical: spacing.lg },
  name: { ...typography.subtitle, color: colors.textPrimary, marginTop: spacing.md },
  homeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  homeText: { ...typography.caption, color: colors.textSecondary },
  bio: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.sm },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  connectionText: { ...typography.body, color: colors.textPrimary },
  connectionHint: { ...typography.body, color: colors.textSecondary, alignSelf: 'flex-start' },
});
