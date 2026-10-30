import { z } from 'zod';
import { paginationQuerySchema } from './common';
import { publicProfileSchema } from './profile';

export const matchCategorySchema = z.enum(['SAME_FLIGHT', 'SAME_DEPARTURE_AIRPORT', 'SAME_LAYOVER_AIRPORT']);
export type MatchCategory = z.infer<typeof matchCategorySchema>;

export const matchSchema = z.object({
  category: matchCategorySchema,
  profile: publicProfileSchema,
  airportIata: z.string().optional(),
  flightNumber: z.string().optional(),
  overlapStartUtc: z.string().datetime(),
  overlapEndUtc: z.string().datetime(),
  overlapMinutes: z.number().int(),
  meetingAccessibilityUnconfirmed: z.boolean(),
  connectionStatus: z.enum(['NONE', 'PENDING_SENT', 'PENDING_RECEIVED', 'ACCEPTED', 'BLOCKED']),
});
export type Match = z.infer<typeof matchSchema>;

export const discoverQuerySchema = paginationQuerySchema.extend({
  journeyId: z.string().uuid().optional(),
  category: matchCategorySchema.optional(),
});
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
