import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { User } from '../../database/entities/person/user.entity';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ListWishlistQueryDto } from '../dtos/wishlist.dtos';
import { WishlistService } from '../services/wishlist.service';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

// A signed-in customer's own wishlist. Suspended customers can still read it.
@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/wishlist', version: '1' })
export class UserWishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @RequireUserAccess('any')
  list(
    @CurrentUserAccount() user: User,
    @Query() query: ListWishlistQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.wishlist.list(user, query, pagination);
  }

  @Get('ids')
  @RequireUserAccess('any')
  ids(@CurrentUserAccount() user: User) {
    return this.wishlist.ids(user);
  }

  @Post(':productId')
  add(@CurrentUserAccount() user: User, @Param('productId', ParseIdPipe) productId: number) {
    return this.wishlist.add(user, productId);
  }

  @Delete(':productId')
  remove(@CurrentUserAccount() user: User, @Param('productId', ParseIdPipe) productId: number) {
    return this.wishlist.remove(user, productId);
  }
}
