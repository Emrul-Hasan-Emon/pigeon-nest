import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { SellerOnboardingQueryDto } from '../dtos/seller-onboarding-query.dto';
import { SellerOnboardingService } from '../services/seller-onboarding.service';

// How far every seller has got with setting up their shop.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/seller-onboarding', version: '1' })
export class AdminSellerOnboardingController {
  constructor(private readonly onboarding: SellerOnboardingService) {}

  @Get()
  list(@Query() query: SellerOnboardingQueryDto) {
    return this.onboarding.list(query.search, query.show, resolvePage(query));
  }

  @Get(':sellerId')
  one(@Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.onboarding.forSeller(sellerId);
  }
}
