import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ListSellerReviewsQueryDto, ReplyDto, ReportDto, SellerSummaryQueryDto } from '../dtos/review.dtos';
import { sellerActor } from '../services/review-core.service';
import { ReviewEngagementService } from '../services/review-engagement.service';
import { ReviewReplyService } from '../services/review-reply.service';
import { ReviewSellerService } from '../services/review-seller.service';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';

// Reading works for a suspended seller too; writing needs an active one.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/reviews', version: '1' })
export class SellerReviewController {
  constructor(
    private readonly reviews: ReviewSellerService,
    private readonly replies: ReviewReplyService,
    private readonly engagement: ReviewEngagementService,
  ) {}

  @Get()
  @RequireSellerAccess('any')
  list(@CurrentSeller() seller: Seller, @Query() query: ListSellerReviewsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.list(seller.id, query, pagination);
  }

  @Get('summary')
  @RequireSellerAccess('any')
  summary(@CurrentSeller() seller: Seller, @Query() query: SellerSummaryQueryDto) {
    return this.reviews.summary(seller.id, query.productId);
  }

  @Post(':id/replies')
  @RequireSellerAccess('full')
  reply(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReplyDto) {
    return this.replies.create(sellerActor(seller), id, dto);
  }

  @Post(':id/report')
  @RequireSellerAccess('full')
  report(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.engagement.reportReview(sellerActor(seller), id, dto);
  }
}
