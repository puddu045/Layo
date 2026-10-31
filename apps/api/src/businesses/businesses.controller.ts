import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  listBusinessesQuerySchema,
  registerBusinessRequestSchema,
  type ListBusinessesQuery,
  type RegisterBusinessRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { BusinessesService } from './businesses.service';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  register(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(registerBusinessRequestSchema)) dto: RegisterBusinessRequest,
  ) {
    return this.businessesService.register(user.id, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: RequestUser) {
    return this.businessesService.listMine(user.id);
  }

  @Get()
  @UseGuards(AdminGuard)
  listAll(@Query(new ZodValidationPipe(listBusinessesQuerySchema)) query: ListBusinessesQuery) {
    return this.businessesService.listAll(query.status);
  }

  @Patch(':id/approve')
  @UseGuards(AdminGuard)
  approve(@Param('id') id: string) {
    return this.businessesService.applyStatusAction(id, 'APPROVE');
  }

  @Patch(':id/reject')
  @UseGuards(AdminGuard)
  reject(@Param('id') id: string) {
    return this.businessesService.applyStatusAction(id, 'REJECT');
  }

  @Patch(':id/suspend')
  @UseGuards(AdminGuard)
  suspend(@Param('id') id: string) {
    return this.businessesService.applyStatusAction(id, 'SUSPEND');
  }

  @Patch(':id/reinstate')
  @UseGuards(AdminGuard)
  reinstate(@Param('id') id: string) {
    return this.businessesService.applyStatusAction(id, 'REINSTATE');
  }
}
