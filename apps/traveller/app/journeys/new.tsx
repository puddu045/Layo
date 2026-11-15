import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  flightLookupRequestSchema,
  flightScheduleSearchRequestSchema,
  manualFlightEntrySchema,
  type AddJourneySegmentRequest,
  type FlightCandidate,
} from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { DatePickerField } from '../../src/components/DatePickerField';
import { DateTimePickerField } from '../../src/components/DateTimePickerField';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useCreateJourney, useFlightLookup, useFlightScheduleSearch } from '../../src/hooks/api-hooks';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

interface AddedSegment {
  key: string;
  summary: string;
  request: AddJourneySegmentRequest;
}

type SearchMode = 'number' | 'route';

export default function NewJourney() {
  const flightLookup = useFlightLookup();
  const scheduleSearch = useFlightScheduleSearch();
  const createJourney = useCreateJourney();

  const [searchMode, setSearchMode] = useState<SearchMode>('number');

  const [flightNumber, setFlightNumber] = useState('');
  const [departureDate, setDepartureDate] = useState('');

  const [routeDeparture, setRouteDeparture] = useState('');
  const [routeDestination, setRouteDestination] = useState('');
  const [routeDate, setRouteDate] = useState('');

  const [lookupError, setLookupError] = useState<string | undefined>();
  const [showManualForm, setShowManualForm] = useState(false);
  const [segments, setSegments] = useState<AddedSegment[]>([]);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [submitError, setSubmitError] = useState<string | undefined>();

  const [manual, setManual] = useState({
    airlineIataCode: '',
    flightNumber: '',
    departureAirportIata: '',
    arrivalAirportIata: '',
    scheduledDepartureUtc: '',
    scheduledArrivalUtc: '',
  });

  // Whichever search just ran — needed so `addCandidate` knows which local departure date to
  // send back when confirming the selection (the server re-verifies by flight number + that
  // same date, regardless of which search found the candidate in the first place).
  const activeSearch = searchMode === 'number' ? flightLookup : scheduleSearch;

  const onSearchByNumber = () => {
    setLookupError(undefined);
    const parsed = flightLookupRequestSchema.safeParse({ flightNumber, departureDate });
    if (!parsed.success) {
      setLookupError(parsed.error.issues[0]?.message ?? 'Enter a valid flight number and date');
      return;
    }
    flightLookup.mutate(parsed.data, {
      onError: (err) => setLookupError(err instanceof Error ? err.message : 'Lookup failed'),
    });
  };

  const onSearchByRoute = () => {
    setLookupError(undefined);
    const parsed = flightScheduleSearchRequestSchema.safeParse({
      departureAirportIata: routeDeparture,
      destinationAirportIata: routeDestination,
      date: routeDate,
    });
    if (!parsed.success) {
      setLookupError(parsed.error.issues[0]?.message ?? 'Enter both airports and a date');
      return;
    }
    scheduleSearch.mutate(parsed.data, {
      onError: (err) => setLookupError(err instanceof Error ? err.message : 'Search failed'),
    });
  };

  const addCandidate = (candidate: FlightCandidate) => {
    const candidateDate = searchMode === 'number' ? departureDate : routeDate;
    setSegments((prev) => [
      ...prev,
      {
        key: candidate.providerRef,
        summary: `${candidate.flightNumber} · ${candidate.departureAirport.iataCode} → ${candidate.arrivalAirport.iataCode}`,
        request: {
          confirmedFlight: {
            flightNumber: candidate.flightNumber,
            departureDate: candidateDate,
            providerRef: candidate.providerRef,
          },
        },
      },
    ]);
    setFlightNumber('');
    setDepartureDate('');
    setRouteDeparture('');
    setRouteDestination('');
    setRouteDate('');
    flightLookup.reset();
    scheduleSearch.reset();
  };

  const addManual = () => {
    const parsed = manualFlightEntrySchema.safeParse({
      ...manual,
      airlineIataCode: manual.airlineIataCode.toUpperCase(),
      flightNumber: manual.flightNumber.toUpperCase(),
      departureAirportIata: manual.departureAirportIata.toUpperCase(),
      arrivalAirportIata: manual.arrivalAirportIata.toUpperCase(),
    });
    if (!parsed.success) {
      setLookupError(parsed.error.issues[0]?.message ?? 'Check the manual entry fields');
      return;
    }
    setSegments((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        summary: `${parsed.data.flightNumber} · ${parsed.data.departureAirportIata} → ${parsed.data.arrivalAirportIata} (unverified)`,
        request: { manualEntry: parsed.data },
      },
    ]);
    setManual({
      airlineIataCode: '',
      flightNumber: '',
      departureAirportIata: '',
      arrivalAirportIata: '',
      scheduledDepartureUtc: '',
      scheduledArrivalUtc: '',
    });
    setShowManualForm(false);
    setLookupError(undefined);
  };

  const removeSegment = (key: string) => {
    setSegments((prev) => prev.filter((s) => s.key !== key));
  };

  const onCreateJourney = async () => {
    setSubmitError(undefined);
    if (segments.length === 0) {
      setSubmitError('Add at least one flight first');
      return;
    }
    try {
      await createJourney.mutateAsync({
        isDiscoverable,
        segments: segments.map((s) => s.request),
      });
      router.replace('/(tabs)/journeys');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create journey');
    }
  };

  return (
    <ScreenContainer>
      {/* 'height' on Android, not undefined: app.json sets softwareKeyboardLayoutMode to "pan"
          (not the more common "resize") specifically so Android never tries to shrink the window
          itself — that was the original plan here, but Expo Go's own prebuilt manifest can't pick
          up app.json's native config at all, so it silently never took effect, and the keyboard
          just sat on top of whatever was focused. Handling it entirely in JS via this behavior,
          with native resize turned off, means it behaves the same in Expo Go, a dev client and a
          production build instead of depending on which one happens to be running it. */}
      <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {segments.length > 0 && (
          <View style={styles.segmentList}>
            {segments.map((s, i) => (
              <View key={s.key} style={styles.segmentRow}>
                <Text style={styles.segmentIndex}>{i + 1}</Text>
                <Text style={styles.segmentSummary}>{s.summary}</Text>
                <Pressable onPress={() => removeSegment(s.key)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.modeToggle}>
          <View style={{ flex: 1 }}>
            <Button
              label="By flight number"
              variant={searchMode === 'number' ? 'primary' : 'secondary'}
              onPress={() => {
                setSearchMode('number');
                setLookupError(undefined);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="By route"
              variant={searchMode === 'route' ? 'primary' : 'secondary'}
              onPress={() => {
                setSearchMode('route');
                setLookupError(undefined);
              }}
            />
          </View>
        </View>

        {searchMode === 'number' ? (
          <Card>
            <Text style={styles.sectionTitle}>
              {segments.length === 0 ? 'Add your first flight' : 'Add another flight'}
            </Text>
            <TextField
              label="Flight number"
              placeholder="BA123"
              autoCapitalize="characters"
              value={flightNumber}
              onChangeText={setFlightNumber}
            />
            <DatePickerField
              label="Departure date"
              value={departureDate}
              onChange={setDepartureDate}
              minimumDate={new Date()}
            />
            {lookupError ? <Text style={styles.error}>{lookupError}</Text> : null}
            <Button label="Search" onPress={onSearchByNumber} loading={flightLookup.isPending} />
          </Card>
        ) : (
          <Card>
            <Text style={styles.sectionTitle}>
              {segments.length === 0 ? 'Find your first flight' : 'Find another flight'}
            </Text>
            <TextField
              label="Departure airport (IATA)"
              placeholder="LHR"
              autoCapitalize="characters"
              value={routeDeparture}
              onChangeText={setRouteDeparture}
            />
            <TextField
              label="Destination airport (IATA)"
              placeholder="DXB"
              autoCapitalize="characters"
              value={routeDestination}
              onChangeText={setRouteDestination}
            />
            <DatePickerField label="Travel date" value={routeDate} onChange={setRouteDate} minimumDate={new Date()} />
            {lookupError ? <Text style={styles.error}>{lookupError}</Text> : null}
            <Button label="Search" onPress={onSearchByRoute} loading={scheduleSearch.isPending} />
          </Card>
        )}

        {activeSearch.data && (
          <View style={styles.results}>
            {activeSearch.data.notice ? <Text style={styles.notice}>{activeSearch.data.notice}</Text> : null}
            {activeSearch.data.candidates.map((candidate) => (
              <Pressable key={candidate.providerRef} onPress={() => addCandidate(candidate)}>
                <Card style={styles.candidateCard}>
                  <Text style={styles.candidateTitle}>
                    {candidate.airline.name} {candidate.flightNumber}
                    {candidate.isCodeshare ? ` (operated as ${candidate.operatingFlightNumber})` : ''}
                  </Text>
                  <Text style={styles.candidateRoute}>
                    {candidate.departureAirport.iataCode} → {candidate.arrivalAirport.iataCode}
                  </Text>
                  <Text style={styles.candidateTime}>
                    {new Date(candidate.scheduledDepartureUtc).toLocaleString()} →{' '}
                    {new Date(candidate.scheduledArrivalUtc).toLocaleString()}
                  </Text>
                  {candidate.status !== 'SCHEDULED' && (
                    <Text style={styles.candidateStatus}>Status: {candidate.status}</Text>
                  )}
                  <Text style={styles.candidateTapHint}>Tap to add this flight</Text>
                </Card>
              </Pressable>
            ))}
            {activeSearch.data.candidates.length === 0 && (
              <Button
                label="Add this flight manually instead"
                variant="secondary"
                onPress={() => setShowManualForm(true)}
              />
            )}
          </View>
        )}

        {showManualForm && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.sectionTitle}>Manual entry (unverified)</Text>
            <Text style={styles.manualNotice}>
              This flight won&apos;t be verified against any schedule provider and will be clearly marked as
              unverified.
            </Text>
            <TextField
              label="Airline code"
              placeholder="BA"
              autoCapitalize="characters"
              value={manual.airlineIataCode}
              onChangeText={(v) => setManual((m) => ({ ...m, airlineIataCode: v }))}
            />
            <TextField
              label="Flight number"
              placeholder="BA999"
              autoCapitalize="characters"
              value={manual.flightNumber}
              onChangeText={(v) => setManual((m) => ({ ...m, flightNumber: v }))}
            />
            <TextField
              label="Departure airport (IATA)"
              placeholder="LHR"
              autoCapitalize="characters"
              value={manual.departureAirportIata}
              onChangeText={(v) => setManual((m) => ({ ...m, departureAirportIata: v }))}
            />
            <TextField
              label="Arrival airport (IATA)"
              placeholder="DXB"
              autoCapitalize="characters"
              value={manual.arrivalAirportIata}
              onChangeText={(v) => setManual((m) => ({ ...m, arrivalAirportIata: v }))}
            />
            <DateTimePickerField
              label="Scheduled departure"
              value={manual.scheduledDepartureUtc}
              onChange={(v) => setManual((m) => ({ ...m, scheduledDepartureUtc: v }))}
            />
            <DateTimePickerField
              label="Scheduled arrival"
              value={manual.scheduledArrivalUtc}
              onChange={(v) => setManual((m) => ({ ...m, scheduledArrivalUtc: v }))}
            />
            <Button label="Add manual flight" onPress={addManual} variant="secondary" />
          </Card>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Discoverable in Discover tab</Text>
          <Switch value={isDiscoverable} onValueChange={setIsDiscoverable} />
        </View>

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <Button
          label={`Create journey${segments.length > 0 ? ` (${segments.length} flight${segments.length > 1 ? 's' : ''})` : ''}`}
          onPress={onCreateJourney}
          loading={createJourney.isPending}
          disabled={segments.length === 0}
        />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: { flex: 1 },
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  modeToggle: { flexDirection: 'row', gap: spacing.sm },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  notice: { ...typography.caption, color: colors.warning, marginBottom: spacing.sm },
  results: { gap: spacing.sm },
  candidateCard: { marginBottom: spacing.sm },
  candidateTitle: { ...typography.subtitle, color: colors.textPrimary },
  candidateRoute: { ...typography.body, color: colors.navy700, marginTop: 2 },
  candidateTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  candidateStatus: { ...typography.caption, color: colors.warning, marginTop: 2, fontWeight: '600' },
  candidateTapHint: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  manualNotice: { ...typography.caption, color: colors.warning, marginBottom: spacing.sm },
  segmentList: { marginBottom: spacing.sm },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  segmentIndex: { ...typography.label, color: colors.navy700, marginRight: spacing.sm },
  segmentSummary: { ...typography.body, color: colors.textPrimary, flex: 1 },
  removeText: { ...typography.caption, color: colors.danger, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { ...typography.body, color: colors.textPrimary },
});
