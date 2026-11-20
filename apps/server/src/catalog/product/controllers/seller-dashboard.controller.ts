import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { SellerAccessGuard } from '../../../auth/guards/seller-access.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RequireSellerAccess } from '../../../auth/decorators/require-seller-access.decorator';
import { CurrentSeller } from '../../../auth/decorators/current-seller.decorator';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import { Seller } from '../../../database/entities/seller/seller.entity';
import { SellerDashboardService } from '../services/seller-dashboard.service';

@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/dashboard', version: '1' })
export class SellerDashboardController {
  constructor(private readonly dashboardService: SellerDashboardService) {}

  @Get()
  summary(@CurrentSeller() seller: Seller) {
    return this.dashboardService.summary(seller);
  }
}
