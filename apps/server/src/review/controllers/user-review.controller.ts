import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { User } from '../../database/entities/person/user.entity';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import {
  CreateReviewDto,
  ListMyReviewsQueryDto,
  ListProductReviewsQueryDto,
  ListRepliesQueryDto,
  ReplyDto,
  ReportDto,
  UpdateReplyDto,
  UpdateReviewDto,
  VotesQueryDto,
} from '../dtos/review.dtos';
import { MAX_IMAGE_BYTES, MAX_REVIEW_IMAGES } from '../review.constants';
import { CommonReviewService, customerActor } from '../services/common-review.service';
import { UserReviewService } from '../services/user-review.service';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

const IMAGES = FilesInterceptor('images', MAX_REVIEW_IMAGES, {
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_REVIEW_IMAGES },
});

@Controller({ path: 'api/user/review', version: '1' })
export class UserReviewController {
  constructor(
    private readonly reviews: UserReviewService,
    private readonly common: CommonReviewService,
  ) {}

  // multipart: orderItemId, rating, title, comment, images (up to 5)
  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Post()
  @UseInterceptors(IMAGES)
  create(@CurrentUserAccount() user: User, @Body() dto: CreateReviewDto, @UploadedFiles() images?: Express.Multer.File[]) {
    return this.reviews.create(user, dto, images);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Get()
  @RequireUserAccess('any')
  mine(@CurrentUserAccount() user: User, @Query() _q: ListMyReviewsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.mine(user, pagination);
  }

  // delivered order lines that still wait for a review
  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Get('pending')
  @RequireUserAccess('any')
  pending(@CurrentUserAccount() user: User, @Query() _q: ListMyReviewsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.pending(user, pagination);
  }

  // ids of the reviews on a product I voted helpful
  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Get('votes')
  @RequireUserAccess('any')
  votes(@CurrentUserAccount() user: User, @Query() query: VotesQueryDto) {
    return this.reviews.votes(user, query.productId);
  }

  // ---- anyone may read a product's rating, its published reviews and their reply threads

  @Get('product/:productId/summary')
  productSummary(@Param('productId', ParseIdPipe) productId: number) {
    return this.reviews.productSummary(productId);
  }

  @Get('product/:productId')
  productList(
    @Param('productId', ParseIdPipe) productId: number,
    @Query() query: ListProductReviewsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.reviews.productList(productId, query, pagination);
  }

  @Get('seller/:sellerId')
  sellerList(
    @Param('sellerId', ParseIdPipe) sellerId: number,
    @Query() query: ListProductReviewsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.reviews.listForSeller(sellerId, query, pagination);
  }

  // ---- replies

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Patch('replies/:id')
  updateReply(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.common.update(customerActor(user), id, dto.body);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Delete('replies/:id')
  removeReply(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.common.remove(customerActor(user), id);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Post('replies/:id/report')
  reportReply(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.common.reportReply(customerActor(user), id, dto);
  }

  // ---- one review

  // Replies straight under the review, or the answers to one reply with ?parentId=
  @Get(':id/replies')
  thread(@Param('id', ParseIdPipe) id: number, @Query() query: ListRepliesQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.common.thread(id, query, pagination);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Get(':id')
  @RequireUserAccess('any')
  one(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.reviews.getMine(user, id);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Patch(':id')
  @UseInterceptors(IMAGES)
  update(
    @CurrentUserAccount() user: User,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateReviewDto,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.reviews.update(user, id, dto, images);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Delete(':id')
  remove(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.reviews.remove(user, id);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Post(':id/helpful')
  helpful(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.reviews.markHelpful(user, id);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Delete(':id/helpful')
  unhelpful(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.reviews.unmarkHelpful(user, id);
  }

  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Post(':id/report')
  report(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.common.reportReview(customerActor(user), id, dto);
  }

  // Only the reviewer may reply (to the review, or to any reply in its thread).
  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Post(':id/replies')
  reply(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReplyDto) {
    return this.common.create(customerActor(user), id, dto);
  }
}
