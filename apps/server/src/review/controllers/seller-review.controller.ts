import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ListSellerReviewsQueryDto, ReplyDto, ReportDto, SellerSummaryQueryDto, UpdateReplyDto } from '../dtos/review.dtos';
import { CommonReviewService, sellerActor } from '../services/common-review.service';
import { SellerReviewService } from '../services/seller-review.service';

// Reading works for a suspended seller too; writing needs an active one.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/review', version: '1' })
export class SellerReviewController {
  constructor(
    private readonly reviews: SellerReviewService,
    private readonly common: CommonReviewService,
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

  // ---- replies

  @Patch('replies/:id')
  @RequireSellerAccess('full')
  updateReply(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.common.update(sellerActor(seller), id, dto.body);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete('replies/:id')
  // @RequireSellerAccess('full')
  // removeReply(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
  //   return this.common.remove(sellerActor(seller), id);
  // }

  @Post('replies/:id/report')
  @RequireSellerAccess('full')
  reportReply(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.common.reportReply(sellerActor(seller), id, dto);
  }

  // ---- one review

  @Post(':id/replies')
  @RequireSellerAccess('full')
  reply(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReplyDto) {
    return this.common.create(sellerActor(seller), id, dto);
  }

  @Post(':id/report')
  @RequireSellerAccess('full')
  report(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.common.reportReview(sellerActor(seller), id, dto);
  }
}
