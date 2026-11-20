import { Module } from '@nestjs/common';
import { AdminSellerController } from './controllers/admin-seller.controller';
import { AdminSellerRequestController } from './controllers/admin-seller-request.controller';
import { AdminSellerStatusHistoryController } from './controllers/admin-seller-status-history.controller';
import { SellerProfileController } from './controllers/seller-profile.controller';
import { AdminSellerService } from './services/admin-seller.service';
import { AdminSellerRequestService } from './services/admin-seller-request.service';
import { CommonSellerService } from './services/common-seller.service';
import { SellerProfileService } from './services/seller-profile.service';
import { SellerStatusHistoryService } from './services/seller-status-history.service';

@Module({
  controllers: [
    AdminSellerController,
    AdminSellerRequestController,
    AdminSellerStatusHistoryController,
    SellerProfileController,
  ],
  providers: [
    AdminSellerService,
    AdminSellerRequestService,
    CommonSellerService,
    SellerProfileService,
    SellerStatusHistoryService,
  ],
  exports: [CommonSellerService, SellerStatusHistoryService],
})
export class SellerModule {}
