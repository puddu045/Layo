import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Connection, MatchCategory } from '@layo/contracts';
import { Avatar } from './Avatar';
import { Chip } from './Chip';
import { Button } from './Button';
import { ImageViewerModal } from './ImageViewerModal';
import { LoadingState } from './StateViews';
import { usePublicProfile } from '../hooks/api-hooks';
import { colors, radius, spacing, typography } from '../theme/tokens';

const CATEGORY_ICON: Record<MatchCategory, keyof typeof Ionicons.glyphMap> = {
  SAME_FLIGHT: 'airplane-outline',
  SAME_DEPARTURE_AIRPORT: 'location-outline',
  SAME_LAYOVER_AIRPORT: 'swap-horizontal-outline',
};

export interface ProfilePreviewMatchInfo {
  category: MatchCategory;
  airportIata?: string;
  flightNumber?: string;
  overlapStartUtc?: string;
}

/** For an already-connected pair (the chat screen, the Chats list) — reads the match context
 * captured once when the connection was made (see ConnectionsService.sendRequest). `undefined`
 * for a connection made before that existed, which the modal shows as a generic "connected on
 * Layo" rather than nothing. */
export function connectionToMatchInfo(connection: Connection): ProfilePreviewMatchInfo | undefined {
  if (!connection.matchCategory) return undefined;
  return {
    category: connection.matchCategory,
    airportIata: connection.matchAirportIata,
    flightNumber: connection.matchFlightNumber,
    overlapStartUtc: connection.matchOverlapStartUtc,
  };
}

function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function describeMatch(match: ProfilePreviewMatchInfo): string {
  const when = match.overlapStartUtc ? ` · ${formatMatchDate(match.overlapStartUtc)}` : '';
  if (match.category === 'SAME_FLIGHT') return `Same flight${match.flightNumber ? ` ${match.flightNumber}` : ''}${when}`;
  if (match.category === 'SAME_DEPARTURE_AIRPORT') return `Same departure airport${match.airportIata ? ` · ${match.airportIata}` : ''}${when}`;
  return `Same layover${match.airportIata ? ` · ${match.airportIata}` : ''}${when}`;
}

interface ProfilePreviewModalProps {
  userId: string | undefined;
  onClose: () => void;
  /** Why Layo matched these two, when known — for an already-connected pair this comes from the
   * Connection's own stored matchCategory/etc. (captured once, at connection time — see
   * ConnectionsService.sendRequest), and for a not-yet-connected Discover card it's that card's
   * own live Match. Omitted entirely (not just unset) shows the generic "connected on Layo"
   * fallback, same as a pre-existing connection from before this was captured. */
  matchInfo?: ProfilePreviewMatchInfo;
}

/** The popup behind tapping a name or photo anywhere in the app — their photo, name, a few
 * profile details, and how the two of you are connected. Visible exactly when `userId` is set;
 * the caller just needs one piece of state. */
export function ProfilePreviewModal({ userId, onClose, matchInfo }: ProfilePreviewModalProps) {
  const profile = usePublicProfile(userId);
  const [viewerOpen, setViewerOpen] = useState(false);

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
                <Pressable
                  onPress={() => profile.data?.photoUrl && setViewerOpen(true)}
                  disabled={!profile.data.photoUrl}
                >
                  <Avatar photoUrl={profile.data.photoUrl} displayName={profile.data.displayName} size={120} />
                </Pressable>
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
                {matchInfo ? (
                  <View style={styles.connectionRow}>
                    <Ionicons name={CATEGORY_ICON[matchInfo.category]} size={15} color={colors.primary} />
                    <Text style={styles.connectionText}>{describeMatch(matchInfo)}</Text>
                  </View>
                ) : (
                  <Text style={styles.connectionHint}>You're connected on Layo.</Text>
                )}
              </>
            )}

            <Button label="Close" variant="ghost" onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>

      <ImageViewerModal
        photoUrl={viewerOpen ? profile.data?.photoUrl : undefined}
        onClose={() => setViewerOpen(false)}
      />
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
