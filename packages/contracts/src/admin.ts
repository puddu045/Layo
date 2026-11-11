import { z } from 'zod';
import { iataAirportCodeSchema } from './common';

// ---------------------------------------------------------------------------
// Admin roles
// ---------------------------------------------------------------------------

export const adminRoleSchema = z.enum(['SUPER_ADMIN', 'MODERATOR', 'BUSINESS_MANAGER']);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const setAdminRoleRequestSchema = z.object({
  role: adminRoleSchema.nullable(), // null revokes admin access entirely
});
export type SetAdminRoleRequest = z.infer<typeof setAdminRoleRequestSchema>;

export const createAdminAccountRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: adminRoleSchema,
});
export type CreateAdminAccountRequest = z.infer<typeof createAdminAccountRequestSchema>;

export const adminAccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().optional(),
  role: adminRoleSchema,
  createdAt: z.string().datetime(),
});
export type AdminAccount = z.infer<typeof adminAccountSchema>;

// ---------------------------------------------------------------------------
// Users (admin search / profile / moderation)
// ---------------------------------------------------------------------------

export const userStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']);
export type AdminUserStatus = z.infer<typeof userStatusSchema>;

export const listAdminUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: userStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const adminUserListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().optional(),
  status: userStatusSchema,
  isAdmin: z.boolean(),
  adminRole: adminRoleSchema.optional(),
  verifiedAt: z.string().datetime().optional(),
  reportsReceivedCount: z.number().int(),
  createdAt: z.string().datetime(),
});
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

export const adminAuditEntrySchema = z.object({
  id: z.string().uuid(),
  actorAdminId: z.string().uuid().optional(),
  actorEmail: z.string().optional(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

export const adminUserDetailSchema = adminUserListItemSchema.extend({
  journeysCount: z.number().int(),
  connectionsCount: z.number().int(),
  reportsFiledCount: z.number().int(),
  blocksInitiatedCount: z.number().int(),
  history: z.array(adminAuditEntrySchema),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const userModerationActionSchema = z.enum(['WARN', 'SUSPEND', 'BAN', 'REINSTATE', 'VERIFY', 'DELETE']);
export type UserModerationAction = z.infer<typeof userModerationActionSchema>;

export const userModerationRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type UserModerationRequest = z.infer<typeof userModerationRequestSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const moderationSettingsSchema = z.object({
  warningThreshold: z.number().int().min(1).max(100),
  escalationThreshold: z.number().int().min(1).max(100),
});
export type ModerationSettings = z.infer<typeof moderationSettingsSchema>;

export const matchingSettingsSchema = z.object({
  enabled: z.boolean(),
  departureAirportWindowMinutesBefore: z.number().int().min(0).max(1440),
  departureAirportWindowMinutesAfter: z.number().int().min(0).max(1440),
  minAirportOverlapMinutes: z.number().int().min(0).max(1440),
});
export type MatchingSettings = z.infer<typeof matchingSettingsSchema>;

export const airportChatSettingsSchema = z.object({
  enabled: z.boolean(),
  accessWindowHoursBefore: z.number().int().min(0).max(72),
  accessWindowHoursAfter: z.number().int().min(0).max(72),
});
export type AirportChatSettings = z.infer<typeof airportChatSettingsSchema>;

export const featureFlagSettingsSchema = z.object({
  businessSelfSignup: z.boolean(),
});
export type FeatureFlagSettings = z.infer<typeof featureFlagSettingsSchema>;

export const settingsSchema = z.object({
  moderation: moderationSettingsSchema,
  matching: matchingSettingsSchema,
  airportChat: airportChatSettingsSchema,
  featureFlags: featureFlagSettingsSchema,
});
export type Settings = z.infer<typeof settingsSchema>;

export const settingsCategorySchema = z.enum(['moderation', 'matching', 'airportChat', 'featureFlags']);
export type SettingsCategory = z.infer<typeof settingsCategorySchema>;

export const updateSettingsRequestSchema = z.object({
  moderation: moderationSettingsSchema.partial().optional(),
  matching: matchingSettingsSchema.partial().optional(),
  airportChat: airportChatSettingsSchema.partial().optional(),
  featureFlags: featureFlagSettingsSchema.partial().optional(),
});
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;

// ---------------------------------------------------------------------------
// Report appeals
// ---------------------------------------------------------------------------

export const appealStatusSchema = z.enum(['PENDING', 'APPROVED', 'DENIED']);
export type AppealStatus = z.infer<typeof appealStatusSchema>;

export const createAppealRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  message: z.string().trim().min(1).max(2000),
});
export type CreateAppealRequest = z.infer<typeof createAppealRequestSchema>;

export const appealSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  message: z.string(),
  status: appealStatusSchema,
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});
export type Appeal = z.infer<typeof appealSchema>;

export const listAppealsQuerySchema = z.object({
  status: appealStatusSchema.optional(),
});
export type ListAppealsQuery = z.infer<typeof listAppealsQuerySchema>;

export const resolveAppealRequestSchema = z.object({
  approve: z.boolean(),
});
export type ResolveAppealRequest = z.infer<typeof resolveAppealRequestSchema>;

// ---------------------------------------------------------------------------
// Airport chat moderation
// ---------------------------------------------------------------------------

export const adminAirportRoomSchema = z.object({
  airportIata: iataAirportCodeSchema,
  name: z.string(),
  participantCount: z.number().int(),
  messageCount: z.number().int(),
  reportedMessageCount: z.number().int(),
  locked: z.boolean(),
  lockedReason: z.string().optional(),
});
export type AdminAirportRoom = z.infer<typeof adminAirportRoomSchema>;

export const lockRoomRequestSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
export type LockRoomRequest = z.infer<typeof lockRoomRequestSchema>;

export const muteUserRequestSchema = z.object({
  userId: z.string().uuid(),
  durationMinutes: z.number().int().positive().max(10_080).optional(), // omit = indefinite
  reason: z.string().trim().max(300).optional(),
});
export type MuteUserRequest = z.infer<typeof muteUserRequestSchema>;

export const adminRoomMessageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  senderDisplayName: z.string(),
  body: z.string(),
  removed: z.boolean(),
  createdAt: z.string().datetime(),
});
export type AdminRoomMessage = z.infer<typeof adminRoomMessageSchema>;

export const adminRoomMuteSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().optional(),
  mutedUntil: z.string().datetime().optional(),
  reason: z.string().optional(),
});
export type AdminRoomMute = z.infer<typeof adminRoomMuteSchema>;

// ---------------------------------------------------------------------------
// Flights & journeys (admin)
// ---------------------------------------------------------------------------

export const listAdminJourneysQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  airportIata: iataAirportCodeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
export type ListAdminJourneysQuery = z.infer<typeof listAdminJourneysQuerySchema>;

export const adminJourneyListItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  userDisplayName: z.string().optional(),
  title: z.string().optional(),
  isDiscoverable: z.boolean(),
  segmentCount: z.number().int(),
  firstDepartureAirportIata: z.string().optional(),
  lastArrivalAirportIata: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type AdminJourneyListItem = z.infer<typeof adminJourneyListItemSchema>;

export const airportTrafficSchema = z.object({
  airportIata: iataAirportCodeSchema,
  journeySegmentCount: z.number().int(),
  roomParticipantCount: z.number().int(),
  businessCount: z.number().int(),
  activeDealCount: z.number().int(),
});
export type AirportTraffic = z.infer<typeof airportTrafficSchema>;

export const flightLookupFailureSchema = z.object({
  id: z.string().uuid(),
  flightNumber: z.string(),
  departureDate: z.string(),
  reason: z.string(),
  createdAt: z.string().datetime(),
});
export type FlightLookupFailure = z.infer<typeof flightLookupFailureSchema>;

export const duplicateJourneyFlagSchema = z.object({
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  flightId: z.string().uuid(),
  flightNumber: z.string(),
  journeyIds: z.array(z.string().uuid()),
});
export type DuplicateJourneyFlag = z.infer<typeof duplicateJourneyFlagSchema>;

// ---------------------------------------------------------------------------
// Announcements / targeted notifications
// ---------------------------------------------------------------------------

export const announcementAudienceSchema = z.enum(['ALL', 'BY_AIRPORT', 'SPECIFIC_USERS']);
export type AnnouncementAudience = z.infer<typeof announcementAudienceSchema>;

export const announcementStatusSchema = z.enum(['SCHEDULED', 'SENT', 'CANCELLED']);
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>;

export const createAnnouncementRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2000),
    audience: announcementAudienceSchema,
    targetAirportIata: iataAirportCodeSchema.optional(),
    targetUserIds: z.array(z.string().uuid()).optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .refine((v) => v.audience !== 'BY_AIRPORT' || !!v.targetAirportIata, {
    message: 'targetAirportIata is required for a BY_AIRPORT announcement',
    path: ['targetAirportIata'],
  })
  .refine((v) => v.audience !== 'SPECIFIC_USERS' || (v.targetUserIds?.length ?? 0) > 0, {
    message: 'targetUserIds is required for a SPECIFIC_USERS announcement',
    path: ['targetUserIds'],
  });
export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementRequestSchema>;

export const announcementSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  audience: announcementAudienceSchema,
  targetAirportIata: z.string().optional(),
  targetUserIds: z.array(z.string().uuid()),
  scheduledAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  status: announcementStatusSchema,
  createdAt: z.string().datetime(),
});
export type Announcement = z.infer<typeof announcementSchema>;

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export const supportCategorySchema = z.enum(['BUG', 'FEEDBACK', 'ACCOUNT', 'OTHER']);
export type SupportCategory = z.infer<typeof supportCategorySchema>;

export const supportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export type SupportStatus = z.infer<typeof supportStatusSchema>;

export const createSupportTicketRequestSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  category: supportCategorySchema.default('OTHER'),
  email: z.string().trim().toLowerCase().email().optional(), // only used when unauthenticated
});
export type CreateSupportTicketRequest = z.infer<typeof createSupportTicketRequestSchema>;

export const listSupportTicketsQuerySchema = z.object({
  status: supportStatusSchema.optional(),
  category: supportCategorySchema.optional(),
});
export type ListSupportTicketsQuery = z.infer<typeof listSupportTicketsQuerySchema>;

export const supportTicketListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  userDisplayName: z.string().optional(),
  subject: z.string(),
  category: supportCategorySchema,
  status: supportStatusSchema,
  replyCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SupportTicketListItem = z.infer<typeof supportTicketListItemSchema>;

export const supportReplySchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  authorLabel: z.string(), // "Admin" or the user's display name/email
  isAdmin: z.boolean(),
  createdAt: z.string().datetime(),
});
export type SupportReply = z.infer<typeof supportReplySchema>;

export const supportTicketDetailSchema = supportTicketListItemSchema.extend({
  body: z.string(),
  replies: z.array(supportReplySchema),
});
export type SupportTicketDetail = z.infer<typeof supportTicketDetailSchema>;

export const updateSupportTicketStatusRequestSchema = z.object({
  status: supportStatusSchema,
});
export type UpdateSupportTicketStatusRequest = z.infer<typeof updateSupportTicketStatusRequestSchema>;

export const createSupportReplyRequestSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
export type CreateSupportReplyRequest = z.infer<typeof createSupportReplyRequestSchema>;

// ---------------------------------------------------------------------------
// Overview & analytics
// ---------------------------------------------------------------------------

export const overviewSchema = z.object({
  totalUsers: z.number().int(),
  newUsersLast30Days: z.number().int(),
  activeJourneys: z.number().int(),
  totalConnections: z.number().int(),
  acceptedConnections: z.number().int(),
  pendingReports: z.number().int(),
  criticalReports: z.number().int(),
  pendingBusinesses: z.number().int(),
  pendingDeals: z.number().int(),
  openSupportTickets: z.number().int(),
  topAirports: z.array(z.object({ airportIata: z.string(), activity: z.number().int() })),
  recentActivity: z.array(adminAuditEntrySchema),
});
export type Overview = z.infer<typeof overviewSchema>;

export const timeSeriesPointSchema = z.object({ date: z.string(), value: z.number() });
export type TimeSeriesPoint = z.infer<typeof timeSeriesPointSchema>;

export const analyticsSchema = z.object({
  userGrowth: z.array(timeSeriesPointSchema),
  journeyTrends: z.array(timeSeriesPointSchema),
  chatActivity: z.array(timeSeriesPointSchema),
  retentionRate: z.number(),
  popularAirports: z.array(z.object({ airportIata: z.string(), count: z.number().int() })),
  matchingSuccessRate: z.number(),
  dealPerformance: z.array(z.object({ status: z.string(), count: z.number().int() })),
});
export type Analytics = z.infer<typeof analyticsSchema>;
