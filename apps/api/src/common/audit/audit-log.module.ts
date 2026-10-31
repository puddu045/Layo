import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

/** Global like `PrismaModule`: every admin-only action across the app should be free to write an
 * audit entry without a module having to explicitly import this one. */
@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
