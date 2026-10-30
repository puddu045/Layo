import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  listMessagesQuerySchema,
  sendMessageRequestSchema,
  type ListMessagesQuery,
  type SendMessageRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { MessagingService } from './messaging.service';

@Controller('connections/:connectionId/messages')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param('connectionId') connectionId: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ) {
    return this.messagingService.list(user.id, connectionId, query);
  }

  @Post()
  send(
    @CurrentUser() user: RequestUser,
    @Param('connectionId') connectionId: string,
    @Body(new ZodValidationPipe(sendMessageRequestSchema)) dto: SendMessageRequest,
  ) {
    return this.messagingService.send(user.id, connectionId, dto);
  }

  @Post('read')
  markRead(@CurrentUser() user: RequestUser, @Param('connectionId') connectionId: string) {
    return this.messagingService.markRead(user.id, connectionId);
  }
}
