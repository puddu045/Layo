import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { AnalyticsService } from './analytics.service';

@Controller('overview')
@UseGuards(AdminGuard)
export class OverviewController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  get() {
    return this.analyticsService.overview();
  }
}
