import { z } from 'zod';
import { iataAirportCodeSchema, isoDateSchema } from './common';

export const MIN_SIGNUP_AGE_YEARS = 18;

function calculateAge(dateOfBirth: string, now: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export const dateOfBirthSchema = isoDateSchema.refine(
  (value) => calculateAge(value) >= MIN_SIGNUP_AGE_YEARS,
  { message: `You must be at least ${MIN_SIGNUP_AGE_YEARS} years old to use this app` },
);

export { calculateAge };

export const createProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  dateOfBirth: dateOfBirthSchema,
  bio: z.string().trim().max(500).optional().default(''),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  homeCityIata: iataAirportCodeSchema.optional(),
  discoverable: z.boolean().default(false),
  photoUrl: z.string().url().optional(),
});
export type CreateProfileRequest = z.infer<typeof createProfileRequestSchema>;

export const updateProfileRequestSchema = createProfileRequestSchema.partial();
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/** Public-facing profile. Never includes date of birth, email or other contact details. */
export const publicProfileSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  age: z.number().int().optional(),
  bio: z.string(),
  interests: z.array(z.string()),
  languages: z.array(z.string()),
  homeCityIata: iataAirportCodeSchema.optional(),
  photoUrl: z.string().url().optional(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** Private, owner-only view of the profile. */
export const ownProfileSchema = publicProfileSchema.extend({
  dateOfBirth: z.string(),
  discoverable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /// From the User table, not Profile — captured but not verified, never exposed publicly.
  phone: z.string().optional(),
});
export type OwnProfile = z.infer<typeof ownProfileSchema>;

/** Loosely E.164: an optional leading `+`, then 7–15 digits — permissive enough for real
 * international numbers without pretending to fully validate them (that needs a verified SMS
 * round-trip, which this app doesn't do). */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Enter a valid phone number, e.g. +14155552671');

export const updatePhoneRequestSchema = z.object({
  phone: phoneSchema.nullable(),
});
export type UpdatePhoneRequest = z.infer<typeof updatePhoneRequestSchema>;
