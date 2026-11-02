import { z } from 'zod';
import { publicProfileSchema } from './profile';

export const connectionStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED']);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/** From the requesting user's point of view: did they send this request, or receive it? */
export const connectionDirectionSchema = z.enum(['SENT', 'RECEIVED']);
export type ConnectionDirection = z.infer<typeof connectionDirectionSchema>;

export const createConnectionRequestSchema = z.object({
  addresseeUserId: z.string().uuid(),
});
export type CreateConnectionRequest = z.infer<typeof createConnectionRequestSchema>;

export const connectionLastMessageSchema = z.object({
  body: z.string(),
  senderId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type ConnectionLastMessage = z.infer<typeof connectionLastMessageSchema>;

export const connectionSchema = z.object({
  id: z.string().uuid(),
  status: connectionStatusSchema,
  direction: connectionDirectionSchema,
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  otherProfile: publicProfileSchema,
  unreadCount: z.number().int(),
  lastMessage: connectionLastMessageSchema.optional(),
  /** Did the viewer block the other participant? Only this direction is exposed — the viewer
   * still has read access to the conversation when true. When the other participant blocked the
   * viewer instead, the messages endpoint denies access outright rather than surfacing a flag. */
  blockedByMe: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Connection = z.infer<typeof connectionSchema>;

export const listConnectionsQuerySchema = z.object({
  status: connectionStatusSchema.optional(),
});
export type ListConnectionsQuery = z.infer<typeof listConnectionsQuerySchema>;
