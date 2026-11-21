import { Module } from '@nestjs/common';
import { FileManagementModule } from '../file-management/file-management.module';
import { OrderFileService } from '../order/services/order-file.service';
import { SettingsModule } from '../settings/settings.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import {
  AdminCommissionController,
  AdminSellerSettingController,
  SellerCommissionController,
} from './controllers/commission.controllers';
import { CommissionDisburseService } from './services/commission-disburse.service';
import { CommissionQueryService } from './services/commission-query.service';
import { CommissionService } from './services/commission.service';
import { SellerSettingService } from './services/seller-setting.service';

@Module({
  imports: [SettingsModule, FileManagementModule],
  controllers: [AdminCommissionController, AdminSellerSettingController, SellerCommissionController],
  providers: [
    CommissionService,
    SellerSettingService,
    CommissionQueryService,
    CommissionDisburseService,
    OrderFileService,
    ActorResolverService,
  ],
  exports: [CommissionService, SellerSettingService],
})
export class CommissionModule {}
