import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { SettingsController, AuditLogController } from '../common/settings/settings.controller';
import { AdminRolesController } from './admin-roles.controller';
import { AdminRolesService } from './admin-roles.service';
import { AppealsController } from './appeals.controller';
import { AppealsService } from './appeals.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { OverviewController } from './overview.controller';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/** Groups every admin-only resource that doesn't already have a natural home in an existing
 * domain module (settings/audit log, admin role management, report appeals, announcements,
 * overview/analytics) — the Users/Reports/Businesses/Deals/Airport-rooms/Journeys/Flights admin
 * routes stay in their own domain modules, next to the non-admin routes they share a service
 * with. */
@Module({
  imports: [NotificationsModule, UsersModule],
  controllers: [
    SettingsController,
    AuditLogController,
    AdminRolesController,
    AppealsController,
    AnnouncementsController,
    OverviewController,
    AnalyticsController,
  ],
  providers: [AdminRolesService, AppealsService, AnnouncementsService, AnalyticsService],
})
export class AdminModule {}
