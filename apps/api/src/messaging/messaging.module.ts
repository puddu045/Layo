import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SafetyModule } from '../safety/safety.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [ConnectionsModule, RealtimeModule, SafetyModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
