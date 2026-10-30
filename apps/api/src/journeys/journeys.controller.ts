import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createJourneyRequestSchema,
  updateJourneyRequestSchema,
  type CreateJourneyRequest,
  type UpdateJourneyRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { JourneysService } from './journeys.service';

@Controller('journeys')
export class JourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createJourneyRequestSchema)) dto: CreateJourneyRequest,
  ) {
    return this.journeysService.createJourney(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.journeysService.listJourneys(user.id);
  }

  @Get(':journeyId')
  get(@CurrentUser() user: RequestUser, @Param('journeyId') journeyId: string) {
    return this.journeysService.getJourney(user.id, journeyId);
  }

  @Patch(':journeyId')
  update(
    @CurrentUser() user: RequestUser,
    @Param('journeyId') journeyId: string,
    @Body(new ZodValidationPipe(updateJourneyRequestSchema)) dto: UpdateJourneyRequest,
  ) {
    return this.journeysService.updateJourney(user.id, journeyId, dto);
  }

  @Delete(':journeyId')
  async remove(@CurrentUser() user: RequestUser, @Param('journeyId') journeyId: string) {
    await this.journeysService.deleteJourney(user.id, journeyId);
    return { success: true };
  }
}
