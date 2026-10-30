import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { flightLookupRequestSchema, manualFlightEntrySchema, type AddJourneySegmentRequest, type FlightCandidate } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { DatePickerField } from '../../src/components/DatePickerField';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useCreateJourney, useFlightLookup } from '../../src/hooks/api-hooks';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

interface AddedSegment {
  key: string;
  summary: string;
  request: AddJourneySegmentRequest;
}

export default function NewJourney() {
  const flightLookup = useFlightLookup();
  const createJourney = useCreateJourney();

  const [flightNumber, setFlightNumber] = useState('');
  const [departureDate, setDepartureDate] = useState('');
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

  const onSearch = () => {
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

  const addCandidate = (candidate: FlightCandidate) => {
    setSegments((prev) => [
      ...prev,
      {
        key: candidate.providerRef,
        summary: `${candidate.flightNumber} · ${candidate.departureAirport.iataCode} → ${candidate.arrivalAirport.iataCode}`,
        request: {
          confirmedFlight: {
            flightNumber: candidate.flightNumber,
            departureDate,
            providerRef: candidate.providerRef,
          },
        },
      },
    ]);
    setFlightNumber('');
    setDepartureDate('');
    flightLookup.reset();
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
          <Button label="Search" onPress={onSearch} loading={flightLookup.isPending} />
        </Card>

        {flightLookup.data && (
          <View style={styles.results}>
            {flightLookup.data.notice ? <Text style={styles.notice}>{flightLookup.data.notice}</Text> : null}
            {flightLookup.data.candidates.map((candidate) => (
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
                  <Text style={styles.candidateTapHint}>Tap to add this flight</Text>
                </Card>
              </Pressable>
            ))}
            {flightLookup.data.candidates.length === 0 && (
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
            <TextField
              label="Scheduled departure (UTC, ISO)"
              placeholder="2026-11-20T22:00:00Z"
              value={manual.scheduledDepartureUtc}
              onChangeText={(v) => setManual((m) => ({ ...m, scheduledDepartureUtc: v }))}
            />
            <TextField
              label="Scheduled arrival (UTC, ISO)"
              placeholder="2026-11-21T08:30:00Z"
              value={manual.scheduledArrivalUtc}
              onChangeText={(v) => setManual((m) => ({ ...m, scheduledArrivalUtc: v }))}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  notice: { ...typography.caption, color: colors.warning, marginBottom: spacing.sm },
  results: { gap: spacing.sm },
  candidateCard: { marginBottom: spacing.sm },
  candidateTitle: { ...typography.subtitle, color: colors.textPrimary },
  candidateRoute: { ...typography.body, color: colors.navy700, marginTop: 2 },
  candidateTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  candidateTapHint: { ...typography.caption, color: colors.teal500, fontWeight: '600', marginTop: spacing.xs },
  manualNotice: { ...typography.caption, color: colors.warning, marginBottom: spacing.sm },
  segmentList: { marginBottom: spacing.sm },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal100,
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
