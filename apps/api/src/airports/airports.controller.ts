import { Controller, Get, Param, Query } from '@nestjs/common';
import { AirportsService } from './airports.service';

@Controller()
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('airports')
  list(@Query('search') search?: string) {
    return this.airportsService.list(search);
  }

  @Get('airports/:iataCode')
  getOne(@Param('iataCode') iataCode: string) {
    return this.airportsService.getByIata(iataCode);
  }

  @Get('airlines')
  listAirlines() {
    return this.airportsService.listAirlines();
  }
}
