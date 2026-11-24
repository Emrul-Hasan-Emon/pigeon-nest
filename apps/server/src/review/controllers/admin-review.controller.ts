import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { AdminListReviewsQueryDto, ListRepliesQueryDto, ModerateDto, ReplyDto, RestoreDto } from '../dtos/review.dtos';
import { ReviewAdminService } from '../services/review-admin.service';
import { ReviewReplyService } from '../services/review-reply.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
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
