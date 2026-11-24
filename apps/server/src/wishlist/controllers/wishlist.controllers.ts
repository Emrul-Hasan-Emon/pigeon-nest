import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { User } from '../../database/entities/person/user.entity';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import {
  AdminListWishlistQueryDto,
  InsightsQueryDto,
  ListWishlistQueryDto,
  MostSavedQueryDto,
} from '../dtos/wishlist.dtos';
import { WishlistInsightsService } from '../services/wishlist-insights.service';
import { WishlistService } from '../services/wishlist.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
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

// How often the seller's own products are saved. Counts only, never customers.
// Suspended sellers can still read it.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/wishlist', version: '1' })
export class SellerWishlistController {
  constructor(private readonly insights: WishlistInsightsService) {}

  @Get('insights')
  insightsFor(@CurrentSeller() seller: Seller, @Query() query: InsightsQueryDto) {
    return this.insights.sellerInsights(seller.id, query.limit, query.search);
  }
}

// Admins read only: they cannot add to or remove from a customer's wishlist.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/wishlist', version: '1' })
export class AdminWishlistController {
  constructor(private readonly insights: WishlistInsightsService) {}

  @Get()
  list(@Query() query: AdminListWishlistQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.insights.adminList(query, pagination);
  }

  @Get('most-saved')
  mostSaved(@Query() query: MostSavedQueryDto) {
    return this.insights.mostSaved(query);
  }
}

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/users/:userId/wishlist', version: '1' })
export class AdminUserWishlistController {
  constructor(private readonly insights: WishlistInsightsService) {}

  @Get()
  list(
    @Param('userId', ParseIdPipe) userId: number,
    @Query() query: AdminListWishlistQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.insights.forUser(userId, query, pagination);
  }
}
