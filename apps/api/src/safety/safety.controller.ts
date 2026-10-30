import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  blockUserRequestSchema,
  createReportRequestSchema,
  type BlockUserRequest,
  type CreateReportRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { BlocksService } from './blocks.service';
import { ReportsService } from './reports.service';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.blocksService.list(user.id);
  }

  @Post()
  block(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(blockUserRequestSchema)) dto: BlockUserRequest,
  ) {
    return this.blocksService.block(user.id, dto.blockedUserId);
  }

  @Delete(':userId')
  unblock(@CurrentUser() user: RequestUser, @Param('userId') blockedUserId: string) {
    return this.blocksService.unblock(user.id, blockedUserId);
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createReportRequestSchema)) dto: CreateReportRequest,
  ) {
    return this.reportsService.create(user.id, dto);
  }
}
