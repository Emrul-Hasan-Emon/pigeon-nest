import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { UserModule } from '../user/user.module';
import { SettingsModule } from '../settings/settings.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminOrderActionController } from './controllers/admin-order-action.controller';
import { AdminPaymentController, SellerPaymentController } from './controllers/payment-list.controllers';
import { AdminOrderController, SellerOrderController } from './controllers/staff-order.controllers';
import { StaffOrderService } from './services/staff-order.service';
import { SellerOrderActionController } from './controllers/seller-order-action.controller';
import { OrderFileService } from './services/order-file.service';
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
  imports: [CartModule, SettingsModule, UserModule],
  controllers: [
    UserCheckoutController,
    UserOrderController,
    AdminOrderController,
    SellerOrderController,
    AdminOrderActionController,
    SellerOrderActionController,
    AdminPaymentController,
    SellerPaymentController,
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
    OrderUpdateService,
    PaymentQueryService,
    ActorResolverService,
  ],
  exports: [OrderStatusService, OrderViewService],
})
export class OrderModule {}
