import { Module } from '@nestjs/common';
import { WishlistModule } from '../wishlist/wishlist.module';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { SellerOverviewController } from './controllers/seller-overview.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { DashboardMetricsService } from './services/dashboard-metrics.service';
import { SellerOverviewService } from './services/seller-overview.service';

@Module({
  imports: [WishlistModule],
  controllers: [AdminDashboardController, SellerOverviewController],
  providers: [DashboardMetricsService, AdminDashboardService, SellerOverviewService],
})
export class DashboardModule {}
