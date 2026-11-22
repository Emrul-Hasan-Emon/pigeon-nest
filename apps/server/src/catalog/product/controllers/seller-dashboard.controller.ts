import { Controller, Get, UseGuards } from '@nestjs/common';
import { SellerAccessGuard } from '../../../auth/guards/seller-access.guard';
import { RequireSellerAccess } from '../../../auth/decorators/require-seller-access.decorator';
import { CurrentSeller } from '../../../auth/decorators/current-seller.decorator';
import { Seller } from '../../../database/entities/seller/seller.entity';
import { SellerDashboardService } from '../services/seller-dashboard.service';
import { SellerAuthGuard } from '../../../auth/guards/seller-auth.guard';

@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/dashboard', version: '1' })
export class SellerDashboardController {
  constructor(private readonly dashboardService: SellerDashboardService) {}

  @Get()
  summary(@CurrentSeller() seller: Seller) {
    return this.dashboardService.summary(seller);
  }
}
