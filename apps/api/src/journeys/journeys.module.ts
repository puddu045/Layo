import { Module } from '@nestjs/common';
import { FlightsModule } from '../flights/flights.module';
import { MessagingModule } from '../messaging/messaging.module';
import { JourneysController } from './journeys.controller';
import { JourneysService } from './journeys.service';

@Module({
  imports: [FlightsModule, MessagingModule],
  controllers: [JourneysController],
  providers: [JourneysService],
  exports: [JourneysService],
})
export class JourneysModule {}
