import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import {
  AdminListReportsQueryDto,
  AdminListReviewsQueryDto,
  ListRepliesQueryDto,
  ModerateDto,
  ReplyDto,
  ResolveReportDto,
  RestoreDto,
  UpdateReplyDto,
} from '../dtos/review.dtos';
import { AdminReviewService } from '../services/admin-review.service';
import { CommonReviewService } from '../services/common-review.service';

// Everything an admin does with reviews: the reviews, their replies, the reports, and one customer's reviews.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/review', version: '1' })
export class AdminReviewController {
  constructor(
    private readonly reviews: AdminReviewService,
    private readonly common: CommonReviewService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Query() query: AdminListReviewsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.list(query, pagination);
  }

  // ---- reports (status defaults to open: the queue still waiting for a decision)

  @Get('reports')
  listReports(@Query() query: AdminListReportsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.reviews.listReports(query, pagination);
  }

  @Post('reports/:id/resolve')
  async resolveReport(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ResolveReportDto) {
    return this.reviews.resolve(await this.actors.resolve(jwt), id, dto);
  }

  // ---- what one customer has written, for support

  @Get('users/:userId')
  listForUser(
    @Param('userId', ParseIdPipe) userId: number,
    @Query() query: AdminListReviewsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.reviews.list({ ...query, userId }, pagination);
  }

  // ---- replies. An admin can edit or delete only a reply they wrote themselves.

  @Patch('replies/:id')
  async updateReply(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.common.update(await this.actors.resolve(jwt), id, dto.body);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete('replies/:id')
  // async removeReply(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number) {
  //   return this.common.remove(await this.actors.resolve(jwt), id);
  // }

  @Post('replies/:id/hide')
  async hideReply(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ModerateDto) {
    return this.reviews.hideReply(await this.actors.resolve(jwt), id, dto.reason);
  }

  @Post('replies/:id/restore')
  async restoreReply(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: RestoreDto) {
    return this.reviews.restoreReply(await this.actors.resolve(jwt), id, dto.reason);
  }

  // ---- one review

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
    return this.common.thread(id, query, pagination, true);
  }

  // Support answers under the name "Support".
  @Post(':id/replies')
  async reply(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ReplyDto) {
    return this.common.create(await this.actors.resolve(jwt), id, dto);
  }
}
