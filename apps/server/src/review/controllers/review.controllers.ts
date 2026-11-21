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
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { User } from '../../database/entities/person/user.entity';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import {
  AdminListReportsQueryDto,
  AdminListReviewsQueryDto,
  CreateReviewDto,
  ListMyReviewsQueryDto,
  ListProductReviewsQueryDto,
  ListRepliesQueryDto,
  ListSellerReviewsQueryDto,
  ModerateDto,
  ReplyDto,
  ReportDto,
  ResolveReportDto,
  RestoreDto,
  SellerSummaryQueryDto,
  UpdateReplyDto,
  UpdateReviewDto,
  VotesQueryDto,
} from '../dtos/review.dtos';
import { MAX_IMAGE_BYTES, MAX_REVIEW_IMAGES } from '../review.constants';
import { customerActor, sellerActor } from '../services/review-core.service';
import { ReviewAdminService } from '../services/review-admin.service';
import { ReviewEngagementService } from '../services/review-engagement.service';
import { ReviewPublicService } from '../services/review-public.service';
import { ReviewReplyService } from '../services/review-reply.service';
import { ReviewSellerService } from '../services/review-seller.service';
import { ReviewService } from '../services/review.service';

const IMAGES = FilesInterceptor('images', MAX_REVIEW_IMAGES, {
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_REVIEW_IMAGES },
});

// ---------------------------------------------------------------- public

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

@UseGuards(AuthGuard, RolesGuard, UserAccessGuard)
@Roles(AuthUserType.USER)
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

@UseGuards(AuthGuard, RolesGuard, UserAccessGuard)
@Roles(AuthUserType.USER)
@Controller({ path: 'api/user/review-replies', version: '1' })
export class UserReviewReplyController {
  constructor(
    private readonly replies: ReviewReplyService,
    private readonly engagement: ReviewEngagementService,
  ) {}

  @Patch(':id')
  update(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.replies.update(customerActor(user), id, dto.body);
  }

  @Delete(':id')
  remove(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.replies.remove(customerActor(user), id);
  }

  @Post(':id/report')
  report(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.engagement.reportReply(customerActor(user), id, dto);
  }
}

// ---------------------------------------------------------------- seller

// Reading works for a suspended seller too; writing needs an active one.
@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
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

@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/review-replies', version: '1' })
export class SellerReviewReplyController {
  constructor(
    private readonly replies: ReviewReplyService,
    private readonly engagement: ReviewEngagementService,
  ) {}

  @Patch(':id')
  update(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.replies.update(sellerActor(seller), id, dto.body);
  }

  @Delete(':id')
  remove(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.replies.remove(sellerActor(seller), id);
  }

  @Post(':id/report')
  report(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.engagement.reportReply(sellerActor(seller), id, dto);
  }
}

// ---------------------------------------------------------------- admin

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/reviews', version: '1' })
export class AdminReviewController {
  constructor(
    private readonly reviews: ReviewAdminService,
    private readonly replies: ReviewReplyService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Query() query: AdminListReviewsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.list(query, pagination);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.reviews.details(id);
  }

  @Post(':id/hide')
  async hide(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ModerateDto) {
    return this.reviews.hide(await this.actors.resolve(jwt), id, dto.reason);
  }

  @Post(':id/restore')
  async restore(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: RestoreDto) {
    return this.reviews.restore(await this.actors.resolve(jwt), id, dto.reason);
  }

  // The whole thread, hidden replies with their text.
  @Get(':id/replies')
  thread(
    @Param('id', ParseIdPipe) id: number,
    @Query() query: ListRepliesQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.replies.thread(id, query, pagination, true);
  }

  // Support answers under the name "Support".
  @Post(':id/replies')
  async reply(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ReplyDto) {
    return this.replies.create(await this.actors.resolve(jwt), id, dto);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/review-replies', version: '1' })
export class AdminReviewReplyController {
  constructor(
    private readonly reviews: ReviewAdminService,
    private readonly replies: ReviewReplyService,
    private readonly actors: ActorResolverService,
  ) {}

  // An admin can edit or delete only a reply they wrote themselves.
  @Patch(':id')
  async update(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.replies.update(await this.actors.resolve(jwt), id, dto.body);
  }

  @Delete(':id')
  async remove(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number) {
    return this.replies.remove(await this.actors.resolve(jwt), id);
  }

  @Post(':id/hide')
  async hide(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ModerateDto) {
    return this.reviews.hideReply(await this.actors.resolve(jwt), id, dto.reason);
  }

  @Post(':id/restore')
  async restore(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: RestoreDto) {
    return this.reviews.restoreReply(await this.actors.resolve(jwt), id, dto.reason);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/review-reports', version: '1' })
export class AdminReviewReportController {
  constructor(
    private readonly reviews: ReviewAdminService,
    private readonly actors: ActorResolverService,
  ) {}

  // status defaults to open: the queue still waiting for a decision
  @Get()
  list(@Query() query: AdminListReportsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.listReports(query, pagination);
  }

  @Post(':id/resolve')
  async resolve(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ResolveReportDto) {
    return this.reviews.resolve(await this.actors.resolve(jwt), id, dto);
  }
}

// What one customer has written, for support.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
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
