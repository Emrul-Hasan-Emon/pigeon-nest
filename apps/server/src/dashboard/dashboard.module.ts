import { Module } from '@nestjs/common';
import { WishlistModule } from '../wishlist/wishlist.module';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { SellerDashboardController } from './controllers/seller-dashboard.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { CommonDashboardService } from './services/common-dashboard.service';
import { SellerDashboardService } from './services/seller-dashboard.service';

@Module({
  imports: [WishlistModule],
  controllers: [AdminDashboardController, SellerDashboardController],
  providers: [CommonDashboardService, AdminDashboardService, SellerDashboardService],
})
export class DashboardModule {}
