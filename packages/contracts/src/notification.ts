import { z } from 'zod';

/** Kept as a plain string (not a strict enum) in the schema and the `Notification` model — new
 * types can be added by whichever service emits them without a migration. These are just the
 * ones the API currently emits, for client-side payload narrowing. */
export const notificationTypeSchema = z.enum([
  'CONNECTION_REQUEST',
  'CONNECTION_ACCEPTED',
  'BUSINESS_STATUS_CHANGED',
  'DEAL_STATUS_CHANGED',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  payload: z.record(z.unknown()),
  readAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

/** Cursor-based, same convention as airport-room message history: omit `cursor` for the first
 * (most recent) page. */
export const listNotificationsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(30),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().uuid().optional(),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;
