import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { RedisModule } from './common/redis/redis.module';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AirportsModule } from './airports/airports.module';
import { FlightsModule } from './flights/flights.module';
import { JourneysModule } from './journeys/journeys.module';
import { MatchingModule } from './matching/matching.module';
import { ConnectionsModule } from './connections/connections.module';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    SupabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AirportsModule,
    FlightsModule,
    JourneysModule,
    MatchingModule,
    ConnectionsModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
})
export class AppModule {}
