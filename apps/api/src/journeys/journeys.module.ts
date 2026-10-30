import { Module } from '@nestjs/common';
import { FlightsModule } from '../flights/flights.module';
import { JourneysController } from './journeys.controller';
import { JourneysService } from './journeys.service';

@Module({
  imports: [FlightsModule],
  controllers: [JourneysController],
  providers: [JourneysService],
  exports: [JourneysService],
})
export class JourneysModule {}
