import { Module } from '@nestjs/common';
import { FlightProviderModule } from '../flight-provider/flight-provider.module';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { FlightScheduleService } from './flight-schedule.service';

@Module({
  imports: [FlightProviderModule],
  controllers: [FlightsController],
  providers: [FlightsService, FlightScheduleService],
  exports: [FlightsService, FlightScheduleService],
})
export class FlightsModule {}
