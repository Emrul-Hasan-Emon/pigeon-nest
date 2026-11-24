import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CartOwner, CurrentCartOwner, OptionalCustomerGuard } from '../../auth/guards/optional-customer.guard';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CancelOrderDto, CheckoutOptionsQueryDto, PlaceOrderDto, TrackOrderQueryDto, UserOrderQueryDto } from '../dtos/order.dtos';
import { UserOrderService } from '../services/user-order.service';

// A customer's checkout and their own orders. A guest uses theirs through x-cart-session.
// Static paths stay above ':id'.
@Controller({ path: 'api/user/order', version: '1' })
export class UserOrderController {
  constructor(private readonly orders: UserOrderService) {}

  @Get()
  @UseGuards(OptionalCustomerGuard)
  list(@CurrentCartOwner() owner: CartOwner, @Query() query: UserOrderQueryDto) {
    return this.orders.list(owner, query);
  }

  @Get('track')
  track(@Query() query: TrackOrderQueryDto) {
    return this.orders.track(query.orderNumber, query.phone);
  }

  // ---- checkout: one cart becomes one order ----

  @Get('checkout/:cartId')
  @UseGuards(OptionalCustomerGuard)
  checkoutOptions(
    @CurrentCartOwner() owner: CartOwner,
    @Param('cartId', ParseIdPipe) cartId: number,
    @Query() query: CheckoutOptionsQueryDto,
  ) {
    return this.orders.checkoutOptions(owner, cartId, query.countryCode);
  }

  @Post('checkout/:cartId/place')
  @UseGuards(OptionalCustomerGuard)
  place(@CurrentCartOwner() owner: CartOwner, @Param('cartId', ParseIdPipe) cartId: number, @Body() dto: PlaceOrderDto) {
    return this.orders.place(owner, cartId, dto);
  }

  // ---- one order ----

  @Get(':id')
  @UseGuards(OptionalCustomerGuard)
  detail(@CurrentCartOwner() owner: CartOwner, @Param('id', ParseIdPipe) id: number) {
    return this.orders.detail(owner, id);
  }

  // Allowed until the seller confirms the order.
  @Post(':id/cancel')
  @UseGuards(OptionalCustomerGuard)
  cancel(@CurrentCartOwner() owner: CartOwner, @Param('id', ParseIdPipe) id: number, @Body() dto: CancelOrderDto) {
    return this.orders.cancel(owner, id, dto.reason);
  }
}
