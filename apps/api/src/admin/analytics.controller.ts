import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  get() {
    return this.analyticsService.analytics();
  }
}
