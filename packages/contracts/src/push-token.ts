import { z } from 'zod';

export const pushPlatformSchema = z.enum(['ios', 'android']);
export type PushPlatform = z.infer<typeof pushPlatformSchema>;

export const registerPushTokenRequestSchema = z.object({
  token: z.string().min(1),
  platform: pushPlatformSchema,
});
export type RegisterPushTokenRequest = z.infer<typeof registerPushTokenRequestSchema>;

export const unregisterPushTokenRequestSchema = z.object({
  token: z.string().min(1),
});
export type UnregisterPushTokenRequest = z.infer<typeof unregisterPushTokenRequestSchema>;
