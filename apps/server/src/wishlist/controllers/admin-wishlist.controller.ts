import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { AdminListWishlistQueryDto, MostSavedQueryDto } from '../dtos/wishlist.dtos';
import { WishlistInsightsService } from '../services/wishlist-insights.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

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
