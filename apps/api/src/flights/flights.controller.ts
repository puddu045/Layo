import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { flightLookupRequestSchema, type FlightLookupRequest } from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminGuard } from '../common/guards/admin.guard';
import { FlightsService } from './flights.service';

@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Post('lookup')
  lookup(@Body(new ZodValidationPipe(flightLookupRequestSchema)) dto: FlightLookupRequest) {
    return this.flightsService.lookup(dto);
  }

  @Get('admin/lookup-failures')
  @UseGuards(AdminGuard)
  listLookupFailures() {
    return this.flightsService.listLookupFailures();
  }
}
