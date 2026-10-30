/* eslint-disable no-console */
import { DateTime } from 'luxon';
import {
  AIRLINE_FIXTURES,
  AIRPORT_FIXTURES,
  DEMO_JOURNEY_FIXTURES,
  FlightDataSource,
  PrismaClient,
  computeCanonicalFlightKey,
  findFlightFixture,
  resolveFixtureTimes,
} from '../src';

const prisma = new PrismaClient();

const airportByIata = new Map(AIRPORT_FIXTURES.map((a) => [a.iataCode, a]));

/** A fixed near-future anchor date so demo journeys always look "upcoming",
 * regardless of when `pnpm db:seed` is actually run. */
function computeBaseDate(): string {
  return DateTime.utc().plus({ days: 7 }).toISODate()!;
}

async function seedReferenceData() {
  for (const airline of AIRLINE_FIXTURES) {
    await prisma.airline.upsert({
      where: { iataCode: airline.iataCode },
      create: airline,
      update: airline,
    });
  }

  for (const airport of AIRPORT_FIXTURES) {
    await prisma.airport.upsert({
      where: { iataCode: airport.iataCode },
      create: airport,
      update: airport,
    });

    await prisma.airportRoom.upsert({
      where: { airportIata: airport.iataCode },
      create: {
        airportIata: airport.iataCode,
        name: `${airport.iataCode} Airport Chat`,
        description: `Meet other travellers passing through ${airport.name}.`,
      },
      update: {},
    });
  }

  console.log(`Seeded ${AIRLINE_FIXTURES.length} airlines and ${AIRPORT_FIXTURES.length} airports/rooms.`);
}

/**
 * Best-effort: also create matching Supabase Auth users so the demo accounts
 * can actually sign in through the app. Skipped gracefully if Supabase env
 * vars aren't configured or the Supabase API isn't reachable (e.g. CI, or a
 * machine without the local Supabase stack running) — the Postgres rows
 * below are created either way, so matching/Discover can still be exercised
 * against the API directly.
 */
async function seedSupabaseAuthUsers() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.warn(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase auth user creation.\n' +
        'Demo rows will still be created in Postgres, but demo accounts cannot sign in until you\n' +
        'create matching Supabase Auth users yourself (see docs/DATA_MODEL.md).',
    );
    return;
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Passw0rd!Demo';

  for (const demo of DEMO_JOURNEY_FIXTURES) {
    try {
      const response = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: demo.userId,
          email: demo.email,
          password: demoPassword,
          email_confirm: true,
        }),
      });
      if (!response.ok && response.status !== 422 /* already exists */) {
        const body = await response.text();
        console.warn(`Could not create Supabase auth user ${demo.email}: ${response.status} ${body}`);
      }
    } catch (err) {
      console.warn(`Supabase auth not reachable, skipping auth user creation (${(err as Error).message}).`);
      return;
    }
  }
  console.log(`Attempted Supabase auth user creation for ${DEMO_JOURNEY_FIXTURES.length} demo accounts.`);
}

async function seedDemoJourneys() {
  const baseDate = computeBaseDate();
  console.log(`Using base date ${baseDate} for demo journeys.`);

  for (const demo of DEMO_JOURNEY_FIXTURES) {
    await prisma.user.upsert({
      where: { id: demo.userId },
      create: { id: demo.userId, email: demo.email },
      update: { email: demo.email },
    });

    await prisma.profile.upsert({
      where: { userId: demo.userId },
      create: {
        userId: demo.userId,
        displayName: demo.displayName,
        dateOfBirth: new Date(`${demo.dateOfBirth}T00:00:00Z`),
        bio: demo.bio,
        interests: demo.interests,
        languages: demo.languages,
        discoverable: true,
      },
      update: {
        displayName: demo.displayName,
        bio: demo.bio,
        interests: demo.interests,
        languages: demo.languages,
        discoverable: true,
      },
    });

    const journeyId = `00000000-0000-4000-9000-${demo.userId.slice(-12)}`;
    await prisma.journey.upsert({
      where: { id: journeyId },
      create: { id: journeyId, userId: demo.userId, isDiscoverable: true },
      update: { isDiscoverable: true },
    });
    // Idempotent re-seeding: clear old segments before re-creating them below.
    await prisma.journeySegment.deleteMany({ where: { journeyId } });

    for (const [index, segmentDef] of demo.segments.entries()) {
      const fixture = findFlightFixture(segmentDef.flightNumber);
      if (!fixture) throw new Error(`Unknown flight fixture: ${segmentDef.flightNumber}`);

      const departureAirport = airportByIata.get(fixture.departureAirportIata);
      const arrivalAirport = airportByIata.get(fixture.arrivalAirportIata);
      if (!departureAirport || !arrivalAirport) {
        throw new Error(`Missing airport fixture for ${fixture.flightNumber}`);
      }

      const localDepartureDate = DateTime.utc()
        .plus({ days: 7 + segmentDef.dayOffsetFromBase })
        .toISODate()!;

      const { scheduledDepartureUtc, scheduledArrivalUtc } = resolveFixtureTimes(
        fixture,
        departureAirport.timezone,
        arrivalAirport.timezone,
        localDepartureDate,
      );

      const canonicalKey = computeCanonicalFlightKey({
        airlineIataCode: fixture.airlineIataCode,
        flightNumber: fixture.flightNumber,
        operatingAirlineIataCode: fixture.operatingAirlineIataCode,
        operatingFlightNumber: fixture.operatingFlightNumber,
        departureAirportIata: fixture.departureAirportIata,
        arrivalAirportIata: fixture.arrivalAirportIata,
        scheduledDepartureUtc,
      });

      const flight = await prisma.flight.upsert({
        where: { canonicalKey },
        create: {
          airlineIataCode: fixture.airlineIataCode,
          flightNumber: fixture.flightNumber,
          operatingFlightNumber: fixture.operatingFlightNumber,
          departureAirportIata: fixture.departureAirportIata,
          arrivalAirportIata: fixture.arrivalAirportIata,
          scheduledDepartureUtc,
          scheduledArrivalUtc,
          departureTerminal: fixture.departureTerminal,
          arrivalTerminal: fixture.arrivalTerminal,
          dataSource: FlightDataSource.MOCK,
          canonicalKey,
        },
        update: {
          scheduledDepartureUtc,
          scheduledArrivalUtc,
        },
      });

      await prisma.journeySegment.create({
        data: {
          journeyId,
          flightId: flight.id,
          sequence: index + 1,
        },
      });
    }
  }

  console.log(`Seeded ${DEMO_JOURNEY_FIXTURES.length} demo travellers with multi-segment journeys.`);
}

async function main() {
  await seedReferenceData();
  await seedSupabaseAuthUsers();
  await seedDemoJourneys();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
