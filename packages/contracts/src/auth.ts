import { z } from 'zod';

export const signUpRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

export const signInRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().optional(),
  userId: z.string().uuid(),
  email: z.string().email(),
  hasProfile: z.boolean(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  isAdmin: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;
