import { Module } from '@nestjs/common';
import { AdminCartController } from './controllers/admin-cart.controller';
import { UserCartController } from './controllers/user-cart.controller';
import { AdminCartService } from './services/admin-cart.service';
import { CartViewService } from './services/cart-view.service';
import { UserCartService } from './services/user-cart.service';

@Module({
  controllers: [UserCartController, AdminCartController],
  providers: [CartViewService, UserCartService, AdminCartService],
  exports: [CartViewService, UserCartService],
})
export class CartModule {}
