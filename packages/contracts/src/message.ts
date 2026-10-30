import { z } from 'zod';

export const sendMessageRequestSchema = z.object({
  connectionId: z.string().uuid(),
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

// Socket.IO event payloads shared between API and clients.
export const socketEvents = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  ROOM_MESSAGE_NEW: 'room-message:new',
  TYPING: 'typing',
} as const;
