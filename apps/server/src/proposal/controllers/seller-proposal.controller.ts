import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { Actor } from '../../shared/types/actor.type';
import { CounterProposalDto, ListSellerProposalsQueryDto, ProposalNoteDto } from '../dtos/proposal.dtos';
import { SkuPriceProposalService } from '../services/sku-price-proposal.service';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';

// Proposals on the seller's own SKUs. Suspended sellers can still read them.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
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
