import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createAnnouncementRequestSchema, type CreateAnnouncementRequest } from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
@UseGuards(AdminGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  create(
    @CurrentUser() admin: RequestUser,
    @Body(new ZodValidationPipe(createAnnouncementRequestSchema)) dto: CreateAnnouncementRequest,
  ) {
    return this.announcementsService.create(admin.id, dto);
  }

  @Get()
  listAll() {
    return this.announcementsService.listAll();
  }

  @Delete(':id')
  cancel(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.announcementsService.cancel(admin.id, id);
  }
}
