import { z } from 'zod';
import { flightNumberSchema, iataAirportCodeSchema, isoDateSchema } from './common';
import { airlineSchema, airportSchema } from './airport';

export const flightStatusSchema = z.enum([
  'SCHEDULED',
  'ACTIVE',
  'LANDED',
  'CANCELLED',
  'DELAYED',
  'DIVERTED',
  'UNKNOWN',
]);
export type FlightStatus = z.infer<typeof flightStatusSchema>;

export const flightDataSourceSchema = z.enum(['MOCK', 'AVIATIONSTACK', 'MANUAL']);
export type FlightDataSource = z.infer<typeof flightDataSourceSchema>;

export const flightLookupRequestSchema = z.object({
  flightNumber: flightNumberSchema,
  departureDate: isoDateSchema,
});
export type FlightLookupRequest = z.infer<typeof flightLookupRequestSchema>;

/** A single candidate flight returned by a provider lookup, pending user confirmation. */
export const flightCandidateSchema = z.object({
  providerRef: z.string(), // opaque id the provider/mock uses to re-fetch this exact candidate
  airline: airlineSchema,
  flightNumber: z.string(),
  operatingFlightNumber: z.string().optional(),
  departureAirport: airportSchema,
  arrivalAirport: airportSchema,
  scheduledDepartureUtc: z.string().datetime(),
  scheduledArrivalUtc: z.string().datetime(),
  departureTerminal: z.string().optional(),
  arrivalTerminal: z.string().optional(),
  status: flightStatusSchema,
  dataSource: flightDataSourceSchema,
  isCodeshare: z.boolean().default(false),
});
export type FlightCandidate = z.infer<typeof flightCandidateSchema>;

export const flightLookupResponseSchema = z.object({
  query: flightLookupRequestSchema,
  candidates: z.array(flightCandidateSchema),
  verified: z.boolean(),
  notice: z.string().optional(),
});
export type FlightLookupResponse = z.infer<typeof flightLookupResponseSchema>;

/** A manually entered flight, used when no provider data is available. Always unverified. */
export const manualFlightEntrySchema = z.object({
  airlineIataCode: z.string().trim().toUpperCase(),
  flightNumber: flightNumberSchema,
  departureAirportIata: iataAirportCodeSchema,
  arrivalAirportIata: iataAirportCodeSchema,
  scheduledDepartureUtc: z.string().datetime(),
  scheduledArrivalUtc: z.string().datetime(),
  departureTerminal: z.string().optional(),
  arrivalTerminal: z.string().optional(),
});
export type ManualFlightEntry = z.infer<typeof manualFlightEntrySchema>;

export const flightSchema = z.object({
  id: z.string().uuid(),
  airline: airlineSchema,
  flightNumber: z.string(),
  operatingFlightNumber: z.string().optional(),
  departureAirport: airportSchema,
  arrivalAirport: airportSchema,
  scheduledDepartureUtc: z.string().datetime(),
  scheduledArrivalUtc: z.string().datetime(),
  departureTerminal: z.string().optional(),
  arrivalTerminal: z.string().optional(),
  status: flightStatusSchema,
  dataSource: flightDataSourceSchema,
  verified: z.boolean(),
});
export type Flight = z.infer<typeof flightSchema>;
