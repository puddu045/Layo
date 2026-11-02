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

export const blockedUserSchema = z.object({
  blockedUserId: z.string().uuid(),
  displayName: z.string(),
  createdAt: z.string().datetime(),
});
export type BlockedUser = z.infer<typeof blockedUserSchema>;

export const reportStatusSchema = z.enum(['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportSchema = z.object({
  id: z.string().uuid(),
  reason: reportReasonSchema,
  status: reportStatusSchema,
  createdAt: z.string().datetime(),
});
export type Report = z.infer<typeof reportSchema>;

export const listReportsQuerySchema = z.object({
  status: reportStatusSchema.optional(),
});
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;

/** A person reference for the admin reports views — not the full public profile, just enough
 * to show who's who in a list or detail screen. */
export const reportPartySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().optional(),
});
export type ReportParty = z.infer<typeof reportPartySchema>;

export const adminReportListItemSchema = z.object({
  id: z.string().uuid(),
  reason: reportReasonSchema,
  status: reportStatusSchema,
  reporter: reportPartySchema,
  reportedUser: reportPartySchema.optional(),
  createdAt: z.string().datetime(),
});
export type AdminReportListItem = z.infer<typeof adminReportListItemSchema>;

/** One message as shown in the admin's read-only conversation view, regardless of whether it
 * came from a 1:1 chat or an airport room. */
export const reportConversationMessageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  senderDisplayName: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
});
export type ReportConversationMessage = z.infer<typeof reportConversationMessageSchema>;

export const adminReportDetailSchema = adminReportListItemSchema.extend({
  details: z.string().optional(),
  // How many distinct people have reported this same user (across all of their non-dismissed
  // reports) — context for how serious this looks beyond just the one report being viewed.
  reportedUserTotalReporterCount: z.number().int().optional(),
  conversation: z.array(reportConversationMessageSchema),
});
export type AdminReportDetail = z.infer<typeof adminReportDetailSchema>;

export const reportActionSchema = z.enum(['DISMISS', 'REVIEW', 'BAN']);
export type ReportAction = z.infer<typeof reportActionSchema>;
