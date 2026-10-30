import { z } from 'zod';
import { iataAirportCodeSchema } from './common';

export const businessStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']);
export type BusinessStatus = z.infer<typeof businessStatusSchema>;

export const businessCategorySchema = z.enum([
  'FOOD_DRINK',
  'DUTY_FREE',
  'LOUNGE',
  'FASHION_RETAIL',
  'TRAVEL_ESSENTIALS',
  'SERVICES',
]);
export type BusinessCategory = z.infer<typeof businessCategorySchema>;

export const registerBusinessRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: businessCategorySchema,
  airportIata: iataAirportCodeSchema,
  contactEmail: z.string().email(),
});
export type RegisterBusinessRequest = z.infer<typeof registerBusinessRequestSchema>;

export const businessSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: businessCategorySchema,
  airportIata: z.string(),
  status: businessStatusSchema,
  contactEmail: z.string().email(),
  createdAt: z.string().datetime(),
});
export type Business = z.infer<typeof businessSchema>;
