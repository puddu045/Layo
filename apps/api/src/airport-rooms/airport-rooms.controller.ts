import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  listRoomMessagesQuerySchema,
  sendRoomMessageRequestSchema,
  type ListRoomMessagesQuery,
  type SendRoomMessageRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AirportRoomsService } from './airport-rooms.service';

@Controller('airport-rooms')
export class AirportRoomsController {
  constructor(private readonly airportRoomsService: AirportRoomsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.airportRoomsService.listMyRooms(user.id);
  }

  @Get(':airportIata')
  getRoom(@CurrentUser() user: RequestUser, @Param('airportIata') airportIata: string) {
    return this.airportRoomsService.getRoom(user.id, airportIata);
  }

  @Get(':airportIata/messages')
  listMessages(
    @CurrentUser() user: RequestUser,
    @Param('airportIata') airportIata: string,
    @Query(new ZodValidationPipe(listRoomMessagesQuerySchema)) query: ListRoomMessagesQuery,
  ) {
    return this.airportRoomsService.listMessages(user.id, airportIata, query);
  }

  @Post(':airportIata/messages')
  postMessage(
    @CurrentUser() user: RequestUser,
    @Param('airportIata') airportIata: string,
    @Body(new ZodValidationPipe(sendRoomMessageRequestSchema)) dto: SendRoomMessageRequest,
  ) {
    return this.airportRoomsService.postMessage(user.id, airportIata, dto.body);
  }
}
