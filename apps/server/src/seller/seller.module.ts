import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { CommissionModule } from '../commission/commission.module';
import { AdminSellerController } from './controllers/admin-seller.controller';
import { SellerProfileController } from './controllers/seller-profile.controller';
import { AdminSellerService } from './services/admin-seller.service';
import { CommonSellerService } from './services/common-seller.service';
import { SellerProfileService } from './services/seller-profile.service';

@Module({
  imports: [CommissionModule],
  controllers: [AdminSellerController, SellerProfileController],
  providers: [AdminSellerService, SellerProfileService, CommonSellerService, ActorResolverService],
  exports: [CommonSellerService],
})
export class SellerModule {}
