import { Module } from '@nestjs/common';
import { FileManagementModule } from '../file-management/file-management.module';
import { OrderFileService } from '../order/services/order-file.service';
import { SettingsModule } from '../settings/settings.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminCommissionController } from './controllers/admin-commission.controller';
import { SellerCommissionController } from './controllers/seller-commission.controller';
import { AdminCommissionService } from './services/admin-commission.service';
import { SellerCommissionService } from './services/seller-commission.service';
import { AdminCommissionDisburseService } from './services/admin-commission-disburse.service';
import { CommonCommissionService } from './services/common-commission.service';

@Module({
  imports: [SettingsModule, FileManagementModule],
  controllers: [AdminCommissionController, SellerCommissionController],
  providers: [
    AdminCommissionService,
    SellerCommissionService,
    CommonCommissionService,
    AdminCommissionDisburseService,
    OrderFileService,
    ActorResolverService,
  ],
  exports: [CommonCommissionService],
})
export class CommissionModule {}
