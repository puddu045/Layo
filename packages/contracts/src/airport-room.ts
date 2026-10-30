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

export const sendRoomMessageRequestSchema = z.object({
  airportIata: iataAirportCodeSchema,
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
