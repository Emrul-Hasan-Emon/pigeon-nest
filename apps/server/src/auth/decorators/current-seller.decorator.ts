import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Seller } from '../../database/entities/seller/seller.entity';

// The seller loaded fresh from the DB by SellerAccessGuard.
export const CurrentSeller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Seller => {
    return ctx.switchToHttp().getRequest().seller;
  },
);
