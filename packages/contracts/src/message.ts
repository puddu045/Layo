import { z } from 'zod';
import { paginationQuerySchema } from './common';

/** The connectionId comes from the URL (`/connections/:connectionId/messages`), not the body. */
export const sendMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string(),
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
