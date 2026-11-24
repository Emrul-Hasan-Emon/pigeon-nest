import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { AdminUserWishlistController } from './controllers/admin-user-wishlist.controller';
import { AdminWishlistController } from './controllers/admin-wishlist.controller';
import { SellerWishlistController } from './controllers/seller-wishlist.controller';
import { UserWishlistController } from './controllers/user-wishlist.controller';
import { WishlistInsightsService } from './services/wishlist-insights.service';
import { WishlistService } from './services/wishlist.service';

@Module({
  imports: [StorefrontModule],
  controllers: [UserWishlistController, SellerWishlistController, AdminWishlistController, AdminUserWishlistController],
  providers: [WishlistService, WishlistInsightsService],
  exports: [WishlistInsightsService],
})
export class WishlistModule {}
