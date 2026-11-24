import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerOnboardingService } from '../services/seller-onboarding.service';

// A seller's own "get your shop ready" checklist. Readable in every state.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/onboarding', version: '1' })
export class SellerOnboardingController {
  constructor(private readonly onboarding: SellerOnboardingService) {}

  @Get()
  get(@CurrentSeller() seller: Seller) {
    return this.onboarding.forSeller(seller.id);
  }
}
