import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createConnectionRequestSchema,
  listConnectionsQuerySchema,
  rejectCandidateRequestSchema,
  type CreateConnectionRequest,
  type ListConnectionsQuery,
  type RejectCandidateRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { ConnectionsService } from './connections.service';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listConnectionsQuerySchema)) query: ListConnectionsQuery,
  ) {
    return this.connectionsService.list(user.id, query);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser) {
    return { count: await this.connectionsService.getTotalUnreadCount(user.id) };
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createConnectionRequestSchema)) dto: CreateConnectionRequest,
  ) {
    return this.connectionsService.sendRequest(user.id, dto.addresseeUserId, dto);
  }

  @Post('reject')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  reject(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(rejectCandidateRequestSchema)) dto: RejectCandidateRequest,
  ) {
    return this.connectionsService.rejectCandidate(user.id, dto.rejectedUserId);
  }

  @Post(':connectionId/accept')
  accept(@CurrentUser() user: RequestUser, @Param('connectionId') connectionId: string) {
    return this.connectionsService.accept(user.id, connectionId);
  }

  @Post(':connectionId/decline')
  decline(@CurrentUser() user: RequestUser, @Param('connectionId') connectionId: string) {
    return this.connectionsService.decline(user.id, connectionId);
  }

  @Post(':connectionId/cancel')
  cancel(@CurrentUser() user: RequestUser, @Param('connectionId') connectionId: string) {
    return this.connectionsService.cancel(user.id, connectionId);
  }
}
