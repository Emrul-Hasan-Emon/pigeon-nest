import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { InsightsQueryDto } from '../dtos/wishlist.dtos';
import { WishlistInsightsService } from '../services/wishlist-insights.service';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';

// How often the seller's own products are saved. Counts only, never customers.
// Suspended sellers can still read it.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/wishlist', version: '1' })
export class SellerWishlistController {
  constructor(private readonly insights: WishlistInsightsService) {}

  @Get('insights')
  insightsFor(@CurrentSeller() seller: Seller, @Query() query: InsightsQueryDto) {
    return this.insights.sellerInsights(seller.id, query.limit, query.search);
  }
}
