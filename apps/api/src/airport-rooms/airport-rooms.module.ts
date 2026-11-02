import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AirportRoomsController } from './airport-rooms.controller';
import { AirportRoomsService } from './airport-rooms.service';
import { AirportRoomRetentionService } from './airport-room-retention.service';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [AirportRoomsController],
  providers: [AirportRoomsService, AirportRoomRetentionService],
  exports: [AirportRoomsService],
})
export class AirportRoomsModule {}
