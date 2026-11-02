import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/** Global like `AuditLogModule` — moderation thresholds, matching rules, and feature flags are
 * read from many unrelated modules (reports, matching, airport-rooms, businesses). */
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
