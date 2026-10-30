import { z } from 'zod';
import { iataAirportCodeSchema } from './common';

export const airportRoomSchema = z.object({
  airportIata: iataAirportCodeSchema,
  name: z.string(),
  description: z.string().optional(),
  participantCount: z.number().int(),
  eligible: z.boolean(),
  accessWindowStartUtc: z.string().datetime().optional(),
  accessWindowEndUtc: z.string().datetime().optional(),
});
export type AirportRoomSummary = z.infer<typeof airportRoomSchema>;

/** The airport comes from the URL (`/airport-rooms/:airportIata/messages`), not the body. */
export const sendRoomMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type SendRoomMessageRequest = z.infer<typeof sendRoomMessageRequestSchema>;

export const roomMessageSchema = z.object({
  id: z.string().uuid(),
  airportIata: z.string(),
  senderId: z.string().uuid(),
  senderDisplayName: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
});
export type RoomMessage = z.infer<typeof roomMessageSchema>;

/** Cursor-based: pass the previous page's `nextCursor` to load older messages.
 * Omit `cursor` for the first page (most recent messages). This is what lets a
 * large room avoid ever sending its full history to a new participant. */
export const listRoomMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type ListRoomMessagesQuery = z.infer<typeof listRoomMessagesQuerySchema>;

export const roomMessagePageSchema = z.object({
  items: z.array(roomMessageSchema),
  nextCursor: z.string().uuid().optional(),
});
export type RoomMessagePage = z.infer<typeof roomMessagePageSchema>;
