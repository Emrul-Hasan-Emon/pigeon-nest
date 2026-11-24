import { Module } from '@nestjs/common';
import { CommissionModule } from '../commission/commission.module';
import { CartModule } from '../cart/cart.module';
import { UserModule } from '../user/user.module';
import { SettingsModule } from '../settings/settings.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminOrderActionController } from './controllers/admin-order-action.controller';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { SellerPaymentController } from './controllers/seller-payment.controller';
import { AdminOrderController } from './controllers/admin-order.controller';
import { SellerOrderController } from './controllers/seller-order.controller';
import { StaffOrderService } from './services/staff-order.service';
import { SellerOrderActionController } from './controllers/seller-order-action.controller';
import { OrderFileService } from './services/order-file.service';
import { AdminRefundController } from './controllers/admin-refund.controller';
import { SellerRefundController } from './controllers/seller-refund.controller';
import { OrderRefundService } from './services/order-refund.service';
import { StaffOrderRefundService } from './services/staff-order-refund.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderUpdateService } from './services/order-update.service';
import { PaymentQueryService } from './services/payment-query.service';
import { UserCheckoutController } from './controllers/user-checkout.controller';
import { UserOrderController } from './controllers/user-order.controller';
import { CheckoutService } from './services/checkout.service';
import { OrderPlacementService } from './services/order-placement.service';
import { OrderStatusService } from './services/order-status.service';
import { OrderViewService } from './services/order-view.service';
import { UserOrderService } from './services/user-order.service';

@Module({
  imports: [CommissionModule, CartModule, SettingsModule, UserModule],
  controllers: [
    UserCheckoutController,
    UserOrderController,
    AdminOrderController,
    SellerOrderController,
    AdminOrderActionController,
    SellerOrderActionController,
    AdminPaymentController,
    SellerPaymentController,
    SellerRefundController,
    AdminRefundController,
  ],
  providers: [
    CheckoutService,
    StaffOrderService,
    OrderPlacementService,
    UserOrderService,
    OrderStatusService,
    OrderViewService,
    OrderFileService,
    OrderPaymentService,
    OrderRefundService,
    StaffOrderRefundService,
    OrderUpdateService,
    PaymentQueryService,
    ActorResolverService,
  ],
  exports: [OrderStatusService, OrderViewService, OrderPaymentService, OrderFileService, OrderRefundService, StaffOrderRefundService],
})
export class OrderModule {}
