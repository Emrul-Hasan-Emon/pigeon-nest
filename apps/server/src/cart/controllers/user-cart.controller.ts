import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  CartOwner,
  CurrentCartOwner,
  OptionalCustomerGuard,
} from '../../auth/guards/optional-customer.guard';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { AddCartItemDto, MergeCartDto, UpdateCartItemDto } from '../dtos/cart.dtos';
import { UserCartService } from '../services/user-cart.service';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

// Customer carts, one per seller. Open to guests: a guest sends x-cart-session,
// a signed-in customer sends the bearer token instead.
@Controller({ path: 'api/user/carts', version: '1' })
export class UserCartController {
  constructor(private readonly carts: UserCartService) {}

  // A fresh guest session id for the browser to keep.
  @Post('session')
  newSession() {
    return { sessionId: this.carts.newSessionId() };
  }

  // Every active cart I have, one per seller.
  @Get()
  @UseGuards(OptionalCustomerGuard)
  list(@CurrentCartOwner() owner: CartOwner) {
    return this.carts.list(owner);
  }

  @Get('summary')
  @UseGuards(OptionalCustomerGuard)
  summary(@CurrentCartOwner() owner: CartOwner) {
    return this.carts.summary(owner);
  }

  @Get('seller/:sellerId')
  @UseGuards(OptionalCustomerGuard)
  forSeller(@CurrentCartOwner() owner: CartOwner, @Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.carts.forSeller(owner, sellerId);
  }

  @Post('items')
  @UseGuards(OptionalCustomerGuard)
  add(@CurrentCartOwner() owner: CartOwner, @Body() dto: AddCartItemDto) {
    return this.carts.add(owner, dto);
  }

  @Patch(':cartId/items/:itemId')
  @UseGuards(OptionalCustomerGuard)
  updateQuantity(
    @CurrentCartOwner() owner: CartOwner,
    @Param('cartId', ParseIdPipe) cartId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.carts.updateQuantity(owner, cartId, itemId, dto.quantity);
  }

  @Delete(':cartId/items/:itemId')
  @UseGuards(OptionalCustomerGuard)
  removeItem(
    @CurrentCartOwner() owner: CartOwner,
    @Param('cartId', ParseIdPipe) cartId: number,
    @Param('itemId', ParseIdPipe) itemId: number,
  ) {
    return this.carts.removeItem(owner, cartId, itemId);
  }

  @Delete(':cartId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OptionalCustomerGuard)
  clear(@CurrentCartOwner() owner: CartOwner, @Param('cartId', ParseIdPipe) cartId: number) {
    return this.carts.clear(owner, cartId);
  }

  // Right after login: fold the guest session's carts into mine.
  @Post('merge')
  @UseGuards(UserAuthGuard, UserAccessGuard)
  merge(@CurrentUser() user: JwtPayload, @Body() dto: MergeCartDto) {
    return this.carts.merge(user.sub, dto.sessionId);
  }
}
