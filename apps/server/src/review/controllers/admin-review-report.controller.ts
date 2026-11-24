import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { AdminListReportsQueryDto, ResolveReportDto } from '../dtos/review.dtos';
import { ReviewAdminService } from '../services/review-admin.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
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
