import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { DashboardQueryDto } from '../dtos/dashboard.dtos';
import { SellerDashboardService } from '../services/seller-dashboard.service';

// The seller dashboard, one call: the seller's own sales, to-do counts, products and wishlist demand. Approved and active sellers only.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/dashboard', version: '1' })
export class SellerDashboardController {
  constructor(private readonly dashboard: SellerDashboardService) {}

  // Only the to-do counts, for the alert bell on every seller page.
  @Get('attention')
  attention(@CurrentSeller() seller: Seller) {
    return this.dashboard.attention(seller);
  }

  @Get()
  get(@CurrentSeller() seller: Seller, @Query() query: DashboardQueryDto) {
    return this.dashboard.overview(seller, query);
  }
}
