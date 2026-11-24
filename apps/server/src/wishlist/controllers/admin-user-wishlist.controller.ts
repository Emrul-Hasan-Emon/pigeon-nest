import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { AdminListWishlistQueryDto } from '../dtos/wishlist.dtos';
import { WishlistInsightsService } from '../services/wishlist-insights.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

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
