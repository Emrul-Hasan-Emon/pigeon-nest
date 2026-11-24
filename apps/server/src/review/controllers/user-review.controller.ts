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
  ReplyDto,
  ReportDto,
  UpdateReviewDto,
  VotesQueryDto,
} from '../dtos/review.dtos';
import { MAX_IMAGE_BYTES, MAX_REVIEW_IMAGES } from '../review.constants';
import { customerActor } from '../services/review-core.service';
import { ReviewEngagementService } from '../services/review-engagement.service';
import { ReviewReplyService } from '../services/review-reply.service';
import { ReviewService } from '../services/review.service';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

const IMAGES = FilesInterceptor('images', MAX_REVIEW_IMAGES, {
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_REVIEW_IMAGES },
});

// ---------------------------------------------------------------- public

@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/reviews', version: '1' })
export class UserReviewController {
  constructor(
    private readonly reviews: ReviewService,
    private readonly engagement: ReviewEngagementService,
    private readonly replies: ReviewReplyService,
  ) {}

  // multipart: orderItemId, rating, title, comment, images (up to 5)
  @Post()
  @UseInterceptors(IMAGES)
  create(@CurrentUserAccount() user: User, @Body() dto: CreateReviewDto, @UploadedFiles() images?: Express.Multer.File[]) {
    return this.reviews.create(user, dto, images);
  }

  @Get()
  @RequireUserAccess('any')
  mine(@CurrentUserAccount() user: User, @Query() _q: ListMyReviewsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.mine(user, pagination);
  }

  // delivered order lines that still wait for a review
  @Get('pending')
  @RequireUserAccess('any')
  pending(@CurrentUserAccount() user: User, @Query() _q: ListMyReviewsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.pending(user, pagination);
  }

  // ids of the reviews on a product I voted helpful
  @Get('votes')
  @RequireUserAccess('any')
  votes(@CurrentUserAccount() user: User, @Query() query: VotesQueryDto) {
    return this.reviews.votes(user, query.productId);
  }

  @Get(':id')
  @RequireUserAccess('any')
  one(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.reviews.getMine(user, id);
  }

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

  @Delete(':id')
  remove(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.reviews.remove(user, id);
  }

  @Post(':id/helpful')
  helpful(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.engagement.markHelpful(user, id);
  }

  @Delete(':id/helpful')
  unhelpful(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.engagement.unmarkHelpful(user, id);
  }

  @Post(':id/report')
  report(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.engagement.reportReview(customerActor(user), id, dto);
  }

  // Only the reviewer may reply (to the review, or to any reply in its thread).
  @Post(':id/replies')
  reply(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReplyDto) {
    return this.replies.create(customerActor(user), id, dto);
  }
}
