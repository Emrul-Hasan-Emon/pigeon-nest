import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CartOwner,
  CurrentCartOwner,
  OptionalCustomerGuard,
} from '../../auth/guards/optional-customer.guard';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CancelOrderDto, TrackOrderQueryDto, UserOrderQueryDto } from '../dtos/order.dtos';
import { UserOrderService } from '../services/user-order.service';

// A customer's own orders. A guest sees theirs through x-cart-session.
@Controller({ path: 'api/user/orders', version: '1' })
export class UserOrderController {
  constructor(private readonly orders: UserOrderService) {}

  @Get()
  @UseGuards(OptionalCustomerGuard)
  list(@CurrentCartOwner() owner: CartOwner, @Query() query: UserOrderQueryDto) {
    return this.orders.list(owner, query);
  }

  // Must stay above ':id'.
  @Get('track')
  track(@Query() query: TrackOrderQueryDto) {
    return this.orders.track(query.orderNumber, query.phone);
  }

  @Get(':id')
  @UseGuards(OptionalCustomerGuard)
  detail(@CurrentCartOwner() owner: CartOwner, @Param('id', ParseIdPipe) id: number) {
    return this.orders.detail(owner, id);
  }

  // Allowed until the seller confirms the order.
  @Post(':id/cancel')
  @UseGuards(OptionalCustomerGuard)
  cancel(
    @CurrentCartOwner() owner: CartOwner,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(owner, id, dto.reason);
  }
}
