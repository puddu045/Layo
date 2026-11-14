import { Controller, Get, Query } from '@nestjs/common';
import { discoverQuerySchema, type DiscoverQuery } from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { MatchingService } from './matching.service';

@Controller('discover')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get()
  discover(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(discoverQuerySchema)) query: DiscoverQuery,
  ) {
    return this.matchingService.discover(user.id, query);
  }
}
