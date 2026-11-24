import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { Actor } from '../../shared/types/actor.type';
import {
  CounterProposalDto,
  CreateProposalDto,
  ListUserProposalsQueryDto,
  ProposalNoteDto,
} from '../dtos/proposal.dtos';
import { SkuPriceProposalService } from '../services/sku-price-proposal.service';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

// A customer's own price proposals. Suspended customers can still read them.
@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/proposals', version: '1' })
export class UserProposalController {
  constructor(private readonly proposals: SkuPriceProposalService) {}

  private actor(user: User): Actor {
    return { id: user.id, type: AuthUserType.USER, name: user.name };
  }

  @Get()
  @RequireUserAccess('any')
  list(
    @CurrentUserAccount() user: User,
    @Query() query: ListUserProposalsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.proposals.listForUser(user, query, pagination);
  }

  // The current proposal for one SKU (open first, else the latest), or { proposal: null }.
  @Get('sku/:skuId')
  @RequireUserAccess('any')
  forSku(@CurrentUserAccount() user: User, @Param('skuId', ParseIdPipe) skuId: number) {
    return this.proposals.forSku(user, skuId);
  }

  @Get(':id')
  @RequireUserAccess('any')
  get(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.proposals.getForUser(user, id);
  }

  @Post()
  create(@CurrentUserAccount() user: User, @Body() dto: CreateProposalDto) {
    return this.proposals.create(user, dto);
  }

  @Post(':id/accept')
  accept(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ProposalNoteDto) {
    return this.proposals.accept(this.actor(user), id, dto);
  }

  @Post(':id/counter')
  counter(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: CounterProposalDto) {
    return this.proposals.counter(this.actor(user), id, dto);
  }

  @Post(':id/reject')
  reject(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ProposalNoteDto) {
    return this.proposals.reject(this.actor(user), id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ProposalNoteDto) {
    return this.proposals.cancel(this.actor(user), id, dto);
  }
}
