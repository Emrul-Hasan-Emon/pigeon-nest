import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import {
  AdminUserWishlistController,
  AdminWishlistController,
  SellerWishlistController,
  UserWishlistController,
} from './controllers/wishlist.controllers';
import { WishlistInsightsService } from './services/wishlist-insights.service';
import { WishlistService } from './services/wishlist.service';

@Module({
  imports: [StorefrontModule],
  controllers: [UserWishlistController, SellerWishlistController, AdminWishlistController, AdminUserWishlistController],
  providers: [WishlistService, WishlistInsightsService],
  exports: [WishlistInsightsService],
})
export class WishlistModule {}
