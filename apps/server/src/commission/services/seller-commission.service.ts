import { Injectable } from '@nestjs/common';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import {
  ListCommissionChangesQueryDto,
  ListCommissionHistoryQueryDto,
  ListDisburseQueryDto,
  ListSettingHistoryQueryDto,
} from '../dtos/commission.dtos';
import { CommonCommissionService } from './common-commission.service';

/** What a seller may read about their own commission. Every read is limited to that seller's id. */
@Injectable()
export class SellerCommissionService {
  constructor(
    private readonly common: CommonCommissionService,
  ) {}

  balance(sellerId: number) {
    return this.common.balanceFor(sellerId);
  }

  setting(sellerId: number) {
    return this.common.commissionView(sellerId);
  }

  settingHistory(sellerId: number, query: ListSettingHistoryQueryDto, pagination: CursorPagination) {
    return this.common.listSettingHistory(query, pagination, sellerId);
  }

  history(sellerId: number, query: ListCommissionHistoryQueryDto, pagination: CursorPagination) {
    return this.common.listHistory(query, pagination, sellerId);
  }

  changes(sellerId: number, query: ListCommissionChangesQueryDto, pagination: CursorPagination) {
    return this.common.listChanges(query, pagination, sellerId);
  }

  disbursements(sellerId: number, query: ListDisburseQueryDto, pagination: CursorPagination) {
    return this.common.listDisburses(query, pagination, sellerId);
  }

  disbursement(sellerId: number, id: number) {
    return this.common.disburseDetails(id, sellerId);
  }
}
