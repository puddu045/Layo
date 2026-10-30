import { z } from 'zod';
import { publicProfileSchema } from './profile';

export const connectionStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED']);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const createConnectionRequestSchema = z.object({
  addresseeUserId: z.string().uuid(),
});
export type CreateConnectionRequest = z.infer<typeof createConnectionRequestSchema>;

export const connectionSchema = z.object({
  id: z.string().uuid(),
  status: connectionStatusSchema,
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  otherProfile: publicProfileSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Connection = z.infer<typeof connectionSchema>;
