/**
 * Deterministic mock-data fixtures shared by:
 *  - `prisma/seed.ts` (creates demo users/journeys for local development)
 *  - `apps/api`'s `MockFlightProvider` (answers ad-hoc flight-number lookups)
 *
 * Keeping one source of truth means a demo journey created by the seed script
 * uses exactly the same flight definitions a user would get back by typing the
 * same flight number into the app.
 *
 * Local times are clock times in the departure/arrival airport's own IANA
 * timezone; `arrivalDayOffset` accounts for overnight flights that land on a
 * later local calendar date than they departed.
 */

export interface AirportFixture {
  iataCode: string;
  icaoCode?: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
}

export const AIRPORT_FIXTURES: AirportFixture[] = [
  {
    iataCode: 'LHR',
    icaoCode: 'EGLL',
    name: 'London Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    latitude: 51.4700,
    longitude: -0.4543,
  },
  {
    iataCode: 'DXB',
    icaoCode: 'OMDB',
    name: 'Dubai International Airport',
    city: 'Dubai',
    country: 'United Arab Emirates',
    timezone: 'Asia/Dubai',
    latitude: 25.2532,
    longitude: 55.3657,
  },
  {
    iataCode: 'HYD',
    icaoCode: 'VOHS',
    name: 'Rajiv Gandhi International Airport',
    city: 'Hyderabad',
    country: 'India',
    timezone: 'Asia/Kolkata',
    latitude: 17.2403,
    longitude: 78.4294,
  },
  {
    iataCode: 'BOM',
    icaoCode: 'VABB',
    name: 'Chhatrapati Shivaji Maharaj International Airport',
    city: 'Mumbai',
    country: 'India',
    timezone: 'Asia/Kolkata',
    latitude: 19.0896,
    longitude: 72.8656,
  },
  {
    iataCode: 'NCL',
    icaoCode: 'EGNT',
    name: 'Newcastle International Airport',
    city: 'Newcastle upon Tyne',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    latitude: 55.0375,
    longitude: -1.6917,
  },
  {
    iataCode: 'AMS',
    icaoCode: 'EHAM',
    name: 'Amsterdam Airport Schiphol',
    city: 'Amsterdam',
    country: 'Netherlands',
    timezone: 'Europe/Amsterdam',
    latitude: 52.3086,
    longitude: 4.7639,
  },
  {
    iataCode: 'SIN',
    icaoCode: 'WSSS',
    name: 'Singapore Changi Airport',
    city: 'Singapore',
    country: 'Singapore',
    timezone: 'Asia/Singapore',
    latitude: 1.3644,
    longitude: 103.9915,
  },
];

export interface AirlineFixture {
  iataCode: string;
  icaoCode?: string;
  name: string;
}

export const AIRLINE_FIXTURES: AirlineFixture[] = [
  { iataCode: 'BA', icaoCode: 'BAW', name: 'British Airways' },
  { iataCode: 'EK', icaoCode: 'UAE', name: 'Emirates' },
  { iataCode: 'KL', icaoCode: 'KLM', name: 'KLM Royal Dutch Airlines' },
  { iataCode: 'AA', icaoCode: 'AAL', name: 'American Airlines' },
];

export interface FlightFixture {
  /** Marketing flight number a user would type in, e.g. "BA123". */
  flightNumber: string;
  airlineIataCode: string;
  /** Set when this fixture is a codeshare: the flight actually operated by another carrier/number. */
  operatingFlightNumber?: string;
  operatingAirlineIataCode?: string;
  departureAirportIata: string;
  arrivalAirportIata: string;
  /** Local clock time (HH:mm) at the departure airport, on the requested departure date. */
  departureLocalTime: string;
  /** Local clock time (HH:mm) at the arrival airport. */
  arrivalLocalTime: string;
  /** 0 = arrives same local calendar date as departure; 1 = arrives the next local calendar date (overnight). */
  arrivalDayOffset: 0 | 1;
  departureTerminal?: string;
  arrivalTerminal?: string;
}

export const FLIGHT_FIXTURES: FlightFixture[] = [
  {
    flightNumber: 'BA123',
    airlineIataCode: 'BA',
    departureAirportIata: 'LHR',
    arrivalAirportIata: 'DXB',
    departureLocalTime: '22:00',
    arrivalLocalTime: '08:30',
    arrivalDayOffset: 1,
    departureTerminal: '5',
    arrivalTerminal: '1',
  },
  {
    // Codeshare: marketed by American Airlines, actually operated by BA123.
    flightNumber: 'AA7890',
    airlineIataCode: 'AA',
    operatingFlightNumber: 'BA123',
    operatingAirlineIataCode: 'BA',
    departureAirportIata: 'LHR',
    arrivalAirportIata: 'DXB',
    departureLocalTime: '22:00',
    arrivalLocalTime: '08:30',
    arrivalDayOffset: 1,
    departureTerminal: '5',
    arrivalTerminal: '1',
  },
  {
    flightNumber: 'EK567',
    airlineIataCode: 'EK',
    departureAirportIata: 'DXB',
    arrivalAirportIata: 'HYD',
    departureLocalTime: '11:00',
    arrivalLocalTime: '15:40',
    arrivalDayOffset: 0,
    departureTerminal: '1',
  },
  {
    flightNumber: 'EK569',
    airlineIataCode: 'EK',
    departureAirportIata: 'DXB',
    arrivalAirportIata: 'BOM',
    departureLocalTime: '11:30',
    arrivalLocalTime: '16:00',
    arrivalDayOffset: 0,
    departureTerminal: '3',
    arrivalTerminal: '2',
  },
  {
    flightNumber: 'KL1234',
    airlineIataCode: 'KL',
    departureAirportIata: 'NCL',
    arrivalAirportIata: 'AMS',
    departureLocalTime: '06:00',
    arrivalLocalTime: '08:30',
    arrivalDayOffset: 0,
  },
  {
    flightNumber: 'EK147',
    airlineIataCode: 'EK',
    departureAirportIata: 'AMS',
    arrivalAirportIata: 'DXB',
    departureLocalTime: '10:00',
    arrivalLocalTime: '18:30',
    arrivalDayOffset: 0,
  },
  {
    flightNumber: 'BA789',
    airlineIataCode: 'BA',
    departureAirportIata: 'LHR',
    arrivalAirportIata: 'SIN',
    departureLocalTime: '23:00',
    arrivalLocalTime: '19:30',
    arrivalDayOffset: 1,
    departureTerminal: '5',
  },
  {
    flightNumber: 'EK303',
    airlineIataCode: 'EK',
    departureAirportIata: 'DXB',
    arrivalAirportIata: 'SIN',
    departureLocalTime: '10:30',
    arrivalLocalTime: '22:00',
    arrivalDayOffset: 0,
    departureTerminal: '1',
  },
];

export function findFlightFixture(flightNumber: string): FlightFixture | undefined {
  const normalized = flightNumber.trim().toUpperCase();
  return FLIGHT_FIXTURES.find((f) => f.flightNumber === normalized);
}

/** A demo traveller's journey, expressed as an ordered list of flight numbers plus the
 * local departure date (at that segment's own departure airport) each should be looked up for. */
export interface DemoJourneyFixture {
  userId: string;
  email: string;
  displayName: string;
  dateOfBirth: string;
  bio: string;
  interests: string[];
  languages: string[];
  segments: Array<{ flightNumber: string; dayOffsetFromBase: number }>;
}

/**
 * `dayOffsetFromBase` is relative to a `baseDate` the seed script computes at run time
 * (a near-future date), so demo data always represents an "upcoming" journey regardless
 * of when `pnpm db:seed` is run.
 */
export const DEMO_JOURNEY_FIXTURES: DemoJourneyFixture[] = [
  {
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'demo-amara@layo.test',
    displayName: 'Amara Okafor',
    dateOfBirth: '1994-03-12',
    bio: 'Product designer heading to Hyderabad for a wedding. Always up for airport coffee.',
    interests: ['photography', 'street food', 'weddings'],
    languages: ['English', 'Igbo'],
    segments: [
      { flightNumber: 'BA123', dayOffsetFromBase: 0 },
      { flightNumber: 'EK567', dayOffsetFromBase: 1 },
    ],
  },
  {
    userId: '00000000-0000-4000-8000-000000000002',
    email: 'demo-vikram@layo.test',
    displayName: 'Vikram Shah',
    dateOfBirth: '1990-07-22',
    bio: 'Consultant, frequent flyer, happy to swap flight-delay stories.',
    interests: ['cricket', 'finance', 'running'],
    languages: ['English', 'Hindi', 'Gujarati'],
    segments: [
      { flightNumber: 'BA123', dayOffsetFromBase: 0 },
      { flightNumber: 'EK569', dayOffsetFromBase: 1 },
    ],
  },
  {
    userId: '00000000-0000-4000-8000-000000000003',
    email: 'demo-priya@layo.test',
    displayName: 'Priya Nair',
    dateOfBirth: '1997-11-02',
    bio: 'Moving to Dubai for a new job! First time flying via Amsterdam.',
    interests: ['reading', 'yoga', 'relocation tips'],
    languages: ['English', 'Malayalam'],
    segments: [
      { flightNumber: 'KL1234', dayOffsetFromBase: 0 },
      { flightNumber: 'EK147', dayOffsetFromBase: 0 },
    ],
  },
  {
    userId: '00000000-0000-4000-8000-000000000004',
    email: 'demo-daniel@layo.test',
    displayName: 'Daniel Cole',
    dateOfBirth: '1988-01-30',
    bio: 'Backpacking through Southeast Asia for 3 months.',
    interests: ['hiking', 'scuba diving', 'budget travel'],
    languages: ['English'],
    segments: [{ flightNumber: 'BA789', dayOffsetFromBase: 0 }],
  },
  {
    userId: '00000000-0000-4000-8000-000000000005',
    email: 'demo-zara@layo.test',
    displayName: 'Zara Hassan',
    dateOfBirth: '1995-05-18',
    bio: 'Marketing manager, stopping in Dubai often for work.',
    interests: ['travel hacking', 'coffee', 'podcasts'],
    languages: ['English', 'Arabic'],
    segments: [{ flightNumber: 'EK303', dayOffsetFromBase: 1 }],
  },
  {
    userId: '00000000-0000-4000-8000-000000000006',
    email: 'demo-noah@layo.test',
    displayName: 'Noah Lindqvist',
    dateOfBirth: '1992-09-09',
    bio: 'Travelling to Dubai on a codeshare ticket — same plane as half of Discover, apparently.',
    interests: ['aviation', 'board games'],
    languages: ['English', 'Swedish'],
    segments: [{ flightNumber: 'AA7890', dayOffsetFromBase: 0 }],
  },
];
