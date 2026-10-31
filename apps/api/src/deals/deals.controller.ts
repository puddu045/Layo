import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createDealRequestSchema,
  listDealsForMeQuerySchema,
  listDealsQuerySchema,
  moderateDealRequestSchema,
  updateDealRequestSchema,
  type CreateDealRequest,
  type ListDealsForMeQuery,
  type ListDealsQuery,
  type ModerateDealRequest,
  type UpdateDealRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { DealsService } from './deals.service';

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createDealRequestSchema)) dto: CreateDealRequest,
  ) {
    return this.dealsService.create(user, dto);
  }

  @Get('for-me')
  listForMe(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listDealsForMeQuerySchema)) query: ListDealsForMeQuery,
  ) {
    return this.dealsService.listForMe(user.id, query.airportIata);
  }

  @Get()
  @UseGuards(AdminGuard)
  listAll(@Query(new ZodValidationPipe(listDealsQuerySchema)) query: ListDealsQuery) {
    return this.dealsService.listAll(query.status);
  }

  @Get('business/:businessId')
  listForBusiness(@CurrentUser() user: RequestUser, @Param('businessId') businessId: string) {
    return this.dealsService.listForBusiness(user, businessId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDealRequestSchema)) dto: UpdateDealRequest,
  ) {
    return this.dealsService.update(user, id, dto);
  }

  @Patch(':id/moderate')
  @UseGuards(AdminGuard)
  moderate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderateDealRequestSchema)) dto: ModerateDealRequest,
  ) {
    return this.dealsService.moderate(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.dealsService.remove(user, id);
  }
}
