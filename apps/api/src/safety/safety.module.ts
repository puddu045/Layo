import { Module } from '@nestjs/common';
import { BlocksController, ReportsController } from './safety.controller';
import { BlocksService } from './blocks.service';
import { ReportsService } from './reports.service';

/** Blocking and reporting are grouped into one module — two small, closely
 * related safety features rather than two near-empty modules. */
@Module({
  controllers: [BlocksController, ReportsController],
  providers: [BlocksService, ReportsService],
  exports: [BlocksService],
})
export class SafetyModule {}
