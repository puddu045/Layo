import { z } from 'zod';
import { flightNumberSchema, isoDateSchema } from './common';
import { flightSchema, manualFlightEntrySchema } from './flight';

/**
 * What the client sends to confirm a flight it already looked up and had the
 * user pick from a result list. The server re-runs the provider lookup for
 * (flightNumber, departureDate) and only accepts the selection if `providerRef`
 * still matches one of the freshly re-fetched candidates — schedule data that
 * actually gets persisted always comes from the server's own provider call,
 * never from client-supplied fields.
 */
export const confirmedFlightSelectionSchema = z.object({
  flightNumber: flightNumberSchema,
  departureDate: isoDateSchema,
  providerRef: z.string().min(1),
});
export type ConfirmedFlightSelection = z.infer<typeof confirmedFlightSelectionSchema>;

export const addJourneySegmentRequestSchema = z.object({
  confirmedFlight: confirmedFlightSelectionSchema.optional(),
  manualEntry: manualFlightEntrySchema.optional(),
}).refine((v) => !!v.confirmedFlight || !!v.manualEntry, {
  message: 'Either confirmedFlight or manualEntry must be provided',
});
export type AddJourneySegmentRequest = z.infer<typeof addJourneySegmentRequestSchema>;

export const createJourneyRequestSchema = z.object({
  title: z.string().trim().max(80).optional(),
  isDiscoverable: z.boolean().default(true),
  segments: z.array(addJourneySegmentRequestSchema).min(1),
});
export type CreateJourneyRequest = z.infer<typeof createJourneyRequestSchema>;

export const layoverSchema = z.object({
  airportIata: z.string(),
  arrivalUtc: z.string().datetime(),
  departureUtc: z.string().datetime(),
  durationMinutes: z.number().int(),
});
export type Layover = z.infer<typeof layoverSchema>;

export const journeySegmentSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int(),
  flight: flightSchema,
});
export type JourneySegment = z.infer<typeof journeySegmentSchema>;

export const journeySchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  isDiscoverable: z.boolean(),
  segments: z.array(journeySegmentSchema),
  layovers: z.array(layoverSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Journey = z.infer<typeof journeySchema>;

export const updateJourneyRequestSchema = z.object({
  title: z.string().trim().max(80).optional(),
  isDiscoverable: z.boolean().optional(),
});
export type UpdateJourneyRequest = z.infer<typeof updateJourneyRequestSchema>;
