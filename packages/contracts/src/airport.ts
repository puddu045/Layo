import { z } from 'zod';
import { iataAirportCodeSchema } from './common';

export const airportSchema = z.object({
  iataCode: iataAirportCodeSchema,
  icaoCode: z.string().optional(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  timezone: z.string(), // IANA timezone, e.g. "Asia/Dubai"
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type Airport = z.infer<typeof airportSchema>;

export const airlineSchema = z.object({
  iataCode: z.string(),
  icaoCode: z.string().optional(),
  name: z.string(),
});
export type Airline = z.infer<typeof airlineSchema>;
