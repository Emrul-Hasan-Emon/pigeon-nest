import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { AdminListReviewsQueryDto } from '../dtos/review.dtos';
import { ReviewAdminService } from '../services/review-admin.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

// What one customer has written, for support.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/users/:userId/reviews', version: '1' })
export class AdminUserReviewController {
  constructor(private readonly reviews: ReviewAdminService) {}

  @Get()
  list(
    @Param('userId', ParseIdPipe) userId: number,
    @Query() query: AdminListReviewsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.reviews.list({ ...query, userId }, pagination);
  }
}
