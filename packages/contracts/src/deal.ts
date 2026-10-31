import { z } from 'zod';
import { iataAirportCodeSchema, isoDateSchema } from './common';

export const dealCategorySchema = z.enum([
  'FOOD_DRINK',
  'DUTY_FREE',
  'LOUNGE',
  'FASHION_RETAIL',
  'TRAVEL_ESSENTIALS',
  'SERVICES',
]);
export type DealCategory = z.infer<typeof dealCategorySchema>;

export const dealStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']);
export type DealStatus = z.infer<typeof dealStatusSchema>;

export const dealLocationTypeSchema = z.enum(['AIRSIDE', 'LANDSIDE', 'UNKNOWN']);
export type DealLocationType = z.infer<typeof dealLocationTypeSchema>;

export const createDealRequestSchema = z
  .object({
    businessId: z.string().uuid().optional(), // omitted when the caller has exactly one approved business
    airportIata: iataAirportCodeSchema,
    terminal: z.string().optional(),
    locationType: dealLocationTypeSchema.default('UNKNOWN'),
    category: dealCategorySchema,
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1000),
    termsAndConditions: z.string().trim().max(2000).optional(),
    promoCode: z.string().trim().max(40).optional(),
    validFrom: isoDateSchema,
    validUntil: isoDateSchema,
  })
  .refine((dto) => dto.validFrom <= dto.validUntil, {
    message: 'validUntil must be on or after validFrom',
    path: ['validUntil'],
  });
export type CreateDealRequest = z.infer<typeof createDealRequestSchema>;

export const updateDealRequestSchema = z
  .object({
    airportIata: iataAirportCodeSchema,
    terminal: z.string().optional(),
    locationType: dealLocationTypeSchema,
    category: dealCategorySchema,
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1000),
    termsAndConditions: z.string().trim().max(2000).optional(),
    promoCode: z.string().trim().max(40).optional(),
    validFrom: isoDateSchema,
    validUntil: isoDateSchema,
  })
  .partial()
  .refine((dto) => !dto.validFrom || !dto.validUntil || dto.validFrom <= dto.validUntil, {
    message: 'validUntil must be on or after validFrom',
    path: ['validUntil'],
  });
export type UpdateDealRequest = z.infer<typeof updateDealRequestSchema>;

export const dealSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  businessName: z.string(),
  airportIata: z.string(),
  terminal: z.string().optional(),
  locationType: dealLocationTypeSchema,
  category: dealCategorySchema,
  title: z.string(),
  description: z.string(),
  termsAndConditions: z.string().optional(),
  promoCode: z.string().optional(),
  validFrom: z.string(),
  validUntil: z.string(),
  status: dealStatusSchema,
  rejectionReason: z.string().optional(),
});
export type Deal = z.infer<typeof dealSchema>;

export const listDealsQuerySchema = z.object({
  status: dealStatusSchema.optional(),
});
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;

export const listDealsForMeQuerySchema = z.object({
  airportIata: iataAirportCodeSchema.optional(),
});
export type ListDealsForMeQuery = z.infer<typeof listDealsForMeQuerySchema>;

export const moderateDealRequestSchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().trim().max(500).optional(),
});
export type ModerateDealRequest = z.infer<typeof moderateDealRequestSchema>;
