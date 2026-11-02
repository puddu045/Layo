import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  assignReportRequestSchema,
  blockUserRequestSchema,
  createReportRequestSchema,
  listReportsQuerySchema,
  type AssignReportRequest,
  type BlockUserRequest,
  type CreateReportRequest,
  type ListReportsQuery,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { RoleGuard } from '../common/guards/role.guard';
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createReportRequestSchema)) dto: CreateReportRequest,
  ) {
    return this.reportsService.create(user.id, dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  listAll(@Query(new ZodValidationPipe(listReportsQuerySchema)) query: ListReportsQuery) {
    return this.reportsService.listAll(query);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  getDetail(@Param('id') id: string) {
    return this.reportsService.getDetail(id);
  }

  @Patch(':id/assign')
  @UseGuards(AdminGuard)
  assign(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignReportRequestSchema)) dto: AssignReportRequest,
  ) {
    return this.reportsService.assign(user.id, id, dto);
  }

  @Patch(':id/dismiss')
  @UseGuards(AdminGuard)
  dismiss(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reportsService.applyAction(user.id, id, 'DISMISS');
  }

  @Patch(':id/review')
  @UseGuards(AdminGuard)
  review(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reportsService.applyAction(user.id, id, 'REVIEW');
  }

  @Patch(':id/ban')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  ban(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reportsService.applyAction(user.id, id, 'BAN');
  }
}
