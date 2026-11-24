import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { ListAdminProposalsQueryDto, ProposalNoteDto } from '../dtos/proposal.dtos';
import { SkuPriceProposalService } from '../services/sku-price-proposal.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

// Every proposal. An admin can reject or cancel a pending or accepted one.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/proposals', version: '1' })
export class AdminProposalController {
  constructor(
    private readonly proposals: SkuPriceProposalService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Query() query: ListAdminProposalsQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.proposals.listForAdmin(query, pagination);
  }

  @Get(':id')
  get(@Param('id', ParseIdPipe) id: number) {
    return this.proposals.getForAdmin(id);
  }

  @Post(':id/reject')
  async reject(@CurrentUser() user: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ProposalNoteDto) {
    return this.proposals.reject(await this.actors.resolve(user), id, dto);
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ProposalNoteDto) {
    return this.proposals.cancel(await this.actors.resolve(user), id, dto);
  }
}
