import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminPaymentClaimController } from './controllers/admin-payment-claim.controller';
import { SellerPaymentClaimController } from './controllers/seller-payment-claim.controller';
import { UserPaymentClaimController } from './controllers/user-payment-claim.controller';
import { CommonPaymentClaimService } from './services/common-payment-claim.service';
import { StaffPaymentClaimService } from './services/staff-payment-claim.service';
import { UserPaymentClaimService } from './services/user-payment-claim.service';

@Module({
  imports: [OrderModule],
  controllers: [UserPaymentClaimController, SellerPaymentClaimController, AdminPaymentClaimController],
  providers: [CommonPaymentClaimService, UserPaymentClaimService, StaffPaymentClaimService, ActorResolverService],
})
export class PaymentClaimModule {}
