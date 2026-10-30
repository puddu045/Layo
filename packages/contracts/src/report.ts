import { z } from 'zod';

export const reportReasonSchema = z.enum([
  'HARASSMENT',
  'SPAM',
  'INAPPROPRIATE_CONTENT',
  'IMPERSONATION',
  'SAFETY_CONCERN',
  'OTHER',
]);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export const createReportRequestSchema = z.object({
  reportedUserId: z.string().uuid().optional(),
  reportedMessageId: z.string().uuid().optional(),
  reportedRoomMessageId: z.string().uuid().optional(),
  reason: reportReasonSchema,
  details: z.string().trim().max(1000).optional(),
}).refine((v) => !!v.reportedUserId || !!v.reportedMessageId || !!v.reportedRoomMessageId, {
  message: 'A report must target a user or a message',
});
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;

export const blockUserRequestSchema = z.object({
  blockedUserId: z.string().uuid(),
});
export type BlockUserRequest = z.infer<typeof blockUserRequestSchema>;

export const reportStatusSchema = z.enum(['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;
