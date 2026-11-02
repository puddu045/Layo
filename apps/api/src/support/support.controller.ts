import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createSupportReplyRequestSchema,
  createSupportTicketRequestSchema,
  listSupportTicketsQuerySchema,
  updateSupportTicketStatusRequestSchema,
  type CreateSupportReplyRequest,
  type CreateSupportTicketRequest,
  type ListSupportTicketsQuery,
  type UpdateSupportTicketStatusRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { SupportService } from './support.service';

@Controller('support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /** Any signed-in traveller — bug reports and feedback from inside the app. */
  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createSupportTicketRequestSchema)) dto: CreateSupportTicketRequest,
  ) {
    return this.supportService.create(user.id, user.email, dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  listAll(@Query(new ZodValidationPipe(listSupportTicketsQuerySchema)) query: ListSupportTicketsQuery) {
    return this.supportService.listAll(query);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  getDetail(@Param('id') id: string) {
    return this.supportService.getDetail(id);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSupportTicketStatusRequestSchema)) dto: UpdateSupportTicketStatusRequest,
  ) {
    return this.supportService.updateStatus(id, dto);
  }

  @Post(':id/replies')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  reply(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createSupportReplyRequestSchema)) dto: CreateSupportReplyRequest,
  ) {
    return this.supportService.reply(admin.id, id, dto);
  }
}
