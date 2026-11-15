import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  flightLookupRequestSchema,
  flightScheduleSearchRequestSchema,
  type FlightLookupRequest,
  type FlightScheduleSearchRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminGuard } from '../common/guards/admin.guard';
import { FlightsService } from './flights.service';
import { FlightScheduleService } from './flight-schedule.service';

@Controller('flights')
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly flightScheduleService: FlightScheduleService,
  ) {}

  @Post('lookup')
  lookup(@Body(new ZodValidationPipe(flightLookupRequestSchema)) dto: FlightLookupRequest) {
    return this.flightsService.lookup(dto);
  }

  /** Tighter than the global per-IP limit (see `app.module.ts`) — this one can trigger a real
   * external API call against a metered monthly quota, so it gets its own, stricter ceiling. */
  @Post('schedule-search')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  scheduleSearch(@Body(new ZodValidationPipe(flightScheduleSearchRequestSchema)) dto: FlightScheduleSearchRequest) {
    return this.flightScheduleService.search(dto);
  }

  @Get('admin/lookup-failures')
  @UseGuards(AdminGuard)
  listLookupFailures() {
    return this.flightsService.listLookupFailures();
  }
}
