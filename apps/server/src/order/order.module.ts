import { Module } from '@nestjs/common';
import { CommissionModule } from '../commission/commission.module';
import { CartModule } from '../cart/cart.module';
import { UserModule } from '../user/user.module';
import { SettingsModule } from '../settings/settings.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminOrderController } from './controllers/admin-order.controller';
import { SellerOrderController } from './controllers/seller-order.controller';
import { UserOrderController } from './controllers/user-order.controller';
import { AdminOrderService } from './services/admin-order.service';
import { CommonOrderService } from './services/common-order.service';
import { SellerOrderService } from './services/seller-order.service';
import { UserOrderService } from './services/user-order.service';
import { AttachmentFileService } from '../shared/services/attachment-file.service';

@Module({
  imports: [CommissionModule, CartModule, SettingsModule, UserModule],
  controllers: [UserOrderController, AdminOrderController, SellerOrderController],
  providers: [AdminOrderService, SellerOrderService, UserOrderService, CommonOrderService, AttachmentFileService, ActorResolverService],
  exports: [CommonOrderService, AttachmentFileService],
})
export class OrderModule {}
