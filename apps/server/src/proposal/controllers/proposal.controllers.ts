import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
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
import { Actor } from '../../shared/types/actor.type';
import {
  CounterProposalDto,
  CreateProposalDto,
  ListAdminProposalsQueryDto,
  ListSellerProposalsQueryDto,
  ListUserProposalsQueryDto,
  ProposalNoteDto,
} from '../dtos/proposal.dtos';
import { SkuPriceProposalService } from '../services/sku-price-proposal.service';

// A customer's own price proposals. Suspended customers can still read them.
@UseGuards(AuthGuard, RolesGuard, UserAccessGuard)
@Roles(AuthUserType.USER)
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

// Proposals on the seller's own SKUs. Suspended sellers can still read them.
@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
@Controller({ path: 'api/seller/proposals', version: '1' })
export class SellerProposalController {
  constructor(private readonly proposals: SkuPriceProposalService) {}

  private actor(seller: Seller): Actor {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  @Get()
  @RequireSellerAccess('any')
  list(
    @CurrentSeller() seller: Seller,
    @Query() query: ListSellerProposalsQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.proposals.listForSeller(seller.id, query, pagination);
  }

  @Get('summary')
  @RequireSellerAccess('any')
  summary(@CurrentSeller() seller: Seller) {
    return this.proposals.sellerSummary(seller.id);
  }

  @Get(':id')
  @RequireSellerAccess('any')
  get(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.proposals.getForSeller(seller.id, id);
  }

  @Post(':id/accept')
  accept(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ProposalNoteDto) {
    return this.proposals.accept(this.actor(seller), id, dto);
  }

  @Post(':id/counter')
  counter(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: CounterProposalDto) {
    return this.proposals.counter(this.actor(seller), id, dto);
  }

  @Post(':id/reject')
  reject(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ProposalNoteDto) {
    return this.proposals.reject(this.actor(seller), id, dto);
  }
}

// Every proposal. An admin can reject or cancel a pending or accepted one.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
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
