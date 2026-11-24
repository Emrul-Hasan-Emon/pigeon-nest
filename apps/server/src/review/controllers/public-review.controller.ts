import { Controller, Get, Param, Query } from '@nestjs/common';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ListProductReviewsQueryDto, ListRepliesQueryDto } from '../dtos/review.dtos';
import { ReviewPublicService } from '../services/review-public.service';
import { ReviewReplyService } from '../services/review-reply.service';

// Anyone may read a product's rating, its published reviews and their reply threads.
@Controller({ path: 'api/user', version: '1' })
export class PublicReviewController {
  constructor(
    private readonly reviews: ReviewPublicService,
    private readonly replies: ReviewReplyService,
  ) {}

  @Get('products/:productId/reviews/summary')
  summary(@Param('productId', ParseIdPipe) productId: number) {
    return this.reviews.summary(productId);
  }

  @Get('products/:productId/reviews')
  list(
    @Param('productId', ParseIdPipe) productId: number,
    @Query() query: ListProductReviewsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.reviews.list(productId, query, pagination);
  }

  @Get('sellers/:sellerId/reviews')
  sellerReviews(
    @Param('sellerId', ParseIdPipe) sellerId: number,
    @Query() query: ListProductReviewsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.reviews.listForSeller(sellerId, query, pagination);
  }

  // Replies straight under the review, or the answers to one reply with ?parentId=
  @Get('reviews/:reviewId/replies')
  thread(
    @Param('reviewId', ParseIdPipe) reviewId: number,
    @Query() query: ListRepliesQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.replies.thread(reviewId, query, pagination);
  }
}

// ---------------------------------------------------------------- customer
