import { Module } from '@nestjs/common';
import { FlightProviderModule } from '../flight-provider/flight-provider.module';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

@Module({
  imports: [FlightProviderModule],
  controllers: [FlightsController],
  providers: [FlightsService],
  exports: [FlightsService],
})
export class FlightsModule {}
