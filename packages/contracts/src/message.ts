import { z } from 'zod';
import { paginationQuerySchema } from './common';

/** The connectionId comes from the URL (`/connections/:connectionId/messages`), not the body. */
export const sendMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  /** The message being replied to, if any — must belong to the same connection (checked
   * server-side); silently ignored otherwise rather than failing the whole send. */
  replyToMessageId: z.string().uuid().optional(),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

/** A lightweight quote of the replied-to message — just enough to render the preview above a
 * reply bubble, resolved fresh from `Message.replyTo` on every read rather than snapshotted at
 * send time, so an edit (if that's ever added) would show up too. Absent whenever
 * `replyToMessageId` is unset, or the original message was itself deleted (the column is nulled
 * out in that case — see the schema). */
export const messageReplyPreviewSchema = z.object({
  id: z.string().uuid(),
  /** Absent if the quoted message was itself a system message — see `messageSchema.senderId`. */
  senderId: z.string().uuid().optional(),
  body: z.string(),
});
export type MessageReplyPreview = z.infer<typeof messageReplyPreviewSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
  /** Absent only for a system message (`isSystem: true`) — an automated message the app itself
   * posts into the conversation, not something either participant typed. */
  senderId: z.string().uuid().optional(),
  body: z.string(),
  isSystem: z.boolean().default(false),
  replyTo: messageReplyPreviewSchema.optional(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().optional(),
});
export type Message = z.infer<typeof messageSchema>;

export const listMessagesQuerySchema = paginationQuerySchema;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

// Socket.IO event payloads shared between API and clients.
export const socketEvents = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  ROOM_MESSAGE_NEW: 'room-message:new',
  TYPING: 'typing',
  NOTIFICATION_NEW: 'notification:new',
} as const;

export const messageNewEventSchema = z.object({
  connectionId: z.string().uuid(),
  message: messageSchema,
});
export type MessageNewEvent = z.infer<typeof messageNewEventSchema>;

export const messageReadEventSchema = z.object({
  connectionId: z.string().uuid(),
  readByUserId: z.string().uuid(),
  readAt: z.string().datetime(),
});
export type MessageReadEvent = z.infer<typeof messageReadEventSchema>;
