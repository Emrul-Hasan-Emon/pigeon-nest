import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CartOwner,
  CurrentCartOwner,
  OptionalCustomerGuard,
} from '../../auth/guards/optional-customer.guard';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CheckoutOptionsQueryDto, PlaceOrderDto } from '../dtos/order.dtos';
import { CheckoutService } from '../services/checkout.service';

// Checkout is per cart: one cart becomes one order. Open to guests (x-cart-session).
@Controller({ path: 'api/user/checkout', version: '1' })
@UseGuards(OptionalCustomerGuard)
export class UserCheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get(':cartId')
  options(
    @CurrentCartOwner() owner: CartOwner,
    @Param('cartId', ParseIdPipe) cartId: number,
    @Query() query: CheckoutOptionsQueryDto,
  ) {
    return this.checkout.options(owner, cartId, query.countryCode);
  }

  @Post(':cartId/place')
  place(
    @CurrentCartOwner() owner: CartOwner,
    @Param('cartId', ParseIdPipe) cartId: number,
    @Body() dto: PlaceOrderDto,
  ) {
    return this.checkout.place(owner, cartId, dto);
  }
}
