import { Module } from '@nestjs/common';
import { AdminSellerController } from './controllers/admin-seller.controller';
import { AdminSellerRequestController } from './controllers/admin-seller-request.controller';
import { SellerProfileController } from './controllers/seller-profile.controller';
import { AdminSellerService } from './services/admin-seller.service';
import { AdminSellerRequestService } from './services/admin-seller-request.service';
import { CommonSellerService } from './services/common-seller.service';
import { SellerProfileService } from './services/seller-profile.service';

@Module({
  controllers: [
    AdminSellerController,
    AdminSellerRequestController,
    SellerProfileController,
  ],
  providers: [
    AdminSellerService,
    AdminSellerRequestService,
    CommonSellerService,
    SellerProfileService,
  ],
  exports: [CommonSellerService],
})
export class SellerModule {}
