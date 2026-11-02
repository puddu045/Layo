import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createAppealRequestSchema,
  listAppealsQuerySchema,
  resolveAppealRequestSchema,
  type CreateAppealRequest,
  type ListAppealsQuery,
  type ResolveAppealRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { Public } from '../common/decorators/public.decorator';
import { AppealsService } from './appeals.service';

@Controller('appeals')
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body(new ZodValidationPipe(createAppealRequestSchema)) dto: CreateAppealRequest) {
    return this.appealsService.create(dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  listAll(@Query(new ZodValidationPipe(listAppealsQuerySchema)) query: ListAppealsQuery) {
    return this.appealsService.listAll(query);
  }

  @Patch(':id/resolve')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  resolve(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveAppealRequestSchema)) dto: ResolveAppealRequest,
  ) {
    return this.appealsService.resolve(admin.id, id, dto);
  }
}
