import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import {
  ListCommissionChangesQueryDto,
  ListCommissionHistoryQueryDto,
  ListDisburseQueryDto,
  ListSettingHistoryQueryDto,
} from '../dtos/commission.dtos';
import { SellerCommissionService } from '../services/seller-commission.service';

// What a seller may see about their own commission. Read only; even a suspended seller can look.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/commission', version: '1' })
export class SellerCommissionController {
  constructor(private readonly commission: SellerCommissionService) {}

  @Get('balance')
  balance(@CurrentSeller() seller: Seller) {
    return this.commission.balance(seller.id);
  }

  @Get('setting')
  setting(@CurrentSeller() seller: Seller) {
    return this.commission.setting(seller.id);
  }

  @Get('setting/history')
  settingHistory(@CurrentSeller() seller: Seller, @Query() query: ListSettingHistoryQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.settingHistory(seller.id, query, pagination);
  }

  @Get('history')
  history(@CurrentSeller() seller: Seller, @Query() query: ListCommissionHistoryQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.history(seller.id, query, pagination);
  }

  @Get('changes')
  changes(@CurrentSeller() seller: Seller, @Query() query: ListCommissionChangesQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.changes(seller.id, query, pagination);
  }

  @Get('disbursements')
  disbursements(@CurrentSeller() seller: Seller, @Query() query: ListDisburseQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.disbursements(seller.id, query, pagination);
  }

  @Get('disbursements/:id')
  disbursement(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.commission.disbursement(seller.id, id);
  }
}
