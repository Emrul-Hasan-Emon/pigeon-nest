import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { CommissionModule } from '../commission/commission.module';
import { AdminSellerController } from './controllers/admin-seller.controller';
import { AdminSellerOnboardingController } from './controllers/admin-seller-onboarding.controller';
import { AdminSellerPaymentAccountController } from './controllers/admin-seller-payment-account.controller';
import { AdminSellerRequestController } from './controllers/admin-seller-request.controller';
import { AdminSellerStatusHistoryController } from './controllers/admin-seller-status-history.controller';
import { SellerPaymentAccountController } from './controllers/seller-payment-account.controller';
import { SellerOnboardingController } from './controllers/seller-onboarding.controller';
import { SellerProfileController } from './controllers/seller-profile.controller';
import { AdminSellerService } from './services/admin-seller.service';
import { AdminSellerRequestService } from './services/admin-seller-request.service';
import { CommonPaymentAccountService } from './services/common-payment-account.service';
import { SellerOnboardingService } from './services/seller-onboarding.service';
import { CommonSellerService } from './services/common-seller.service';
import { SellerProfileService } from './services/seller-profile.service';
import { SellerStatusHistoryService } from './services/seller-status-history.service';

@Module({
  imports: [CommissionModule],
  controllers: [
    AdminSellerController,
    AdminSellerRequestController,
    AdminSellerStatusHistoryController,
    AdminSellerOnboardingController,
    AdminSellerPaymentAccountController,
    SellerPaymentAccountController,
    SellerOnboardingController,
    SellerProfileController,
  ],
  providers: [
    AdminSellerService,
    AdminSellerRequestService,
    CommonSellerService,
    SellerProfileService,
    SellerOnboardingService,
    CommonPaymentAccountService,
    ActorResolverService,
    SellerStatusHistoryService,
  ],
  exports: [CommonSellerService, SellerStatusHistoryService],
})
export class SellerModule {}
