import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealExpiryService } from './deal-expiry.service';

@Module({
  imports: [BusinessesModule],
  controllers: [DealsController],
  providers: [DealsService, DealExpiryService],
})
export class DealsModule {}
