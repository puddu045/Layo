import { Controller, Get, Param, Query } from '@nestjs/common';
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

  /** Powers the "how are we connected" section of the profile preview popup. */
  @Get('with/:userId')
  withUser(@CurrentUser() user: RequestUser, @Param('userId') otherUserId: string) {
    return this.matchingService.getMatchContext(user.id, otherUserId);
  }
}
