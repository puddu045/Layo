import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  listRoomMessagesQuerySchema,
  lockRoomRequestSchema,
  muteUserRequestSchema,
  sendRoomMessageRequestSchema,
  type ListRoomMessagesQuery,
  type LockRoomRequest,
  type MuteUserRequest,
  type SendRoomMessageRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { RoleGuard } from '../common/guards/role.guard';
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

  // -- Admin moderation -------------------------------------------------------------------

  @Get('admin/all')
  @UseGuards(AdminGuard)
  adminListRooms() {
    return this.airportRoomsService.adminListRooms();
  }

  @Get(':airportIata/admin/messages')
  @UseGuards(AdminGuard)
  adminListMessages(@Param('airportIata') airportIata: string) {
    return this.airportRoomsService.adminListMessages(airportIata);
  }

  @Delete(':airportIata/admin/messages/:messageId')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  removeMessage(
    @CurrentUser() admin: RequestUser,
    @Param('airportIata') airportIata: string,
    @Param('messageId') messageId: string,
  ) {
    return this.airportRoomsService.removeMessage(admin.id, airportIata, messageId);
  }

  @Patch(':airportIata/admin/lock')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  lockRoom(
    @CurrentUser() admin: RequestUser,
    @Param('airportIata') airportIata: string,
    @Body(new ZodValidationPipe(lockRoomRequestSchema)) dto: LockRoomRequest,
  ) {
    return this.airportRoomsService.lockRoom(admin.id, airportIata, dto);
  }

  @Patch(':airportIata/admin/unlock')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  unlockRoom(@CurrentUser() admin: RequestUser, @Param('airportIata') airportIata: string) {
    return this.airportRoomsService.unlockRoom(admin.id, airportIata);
  }

  @Get(':airportIata/admin/mutes')
  @UseGuards(AdminGuard)
  listMutes(@Param('airportIata') airportIata: string) {
    return this.airportRoomsService.listMutes(airportIata);
  }

  @Post(':airportIata/admin/mutes')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  muteUser(
    @CurrentUser() admin: RequestUser,
    @Param('airportIata') airportIata: string,
    @Body(new ZodValidationPipe(muteUserRequestSchema)) dto: MuteUserRequest,
  ) {
    return this.airportRoomsService.muteUser(admin.id, airportIata, dto);
  }

  @Delete(':airportIata/admin/mutes/:userId')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  unmuteUser(
    @CurrentUser() admin: RequestUser,
    @Param('airportIata') airportIata: string,
    @Param('userId') userId: string,
  ) {
    return this.airportRoomsService.unmuteUser(admin.id, airportIata, userId);
  }
}
