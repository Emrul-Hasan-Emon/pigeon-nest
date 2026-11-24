import { Injectable } from '@nestjs/common';
import { Actor } from '../../shared/types/actor.type';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import {
  DisburseCommissionDto,
  ListBalanceQueryDto,
  ListCommissionChangesQueryDto,
  ListCommissionHistoryQueryDto,
  ListDisburseQueryDto,
  ListSettingHistoryQueryDto,
  SetSellerCommissionDto,
} from '../dtos/commission.dtos';
import { AdminCommissionDisburseService } from './admin-commission-disburse.service';
import { CommonCommissionService } from './common-commission.service';

/** What an admin does with commission: read every seller's balance and ledger, record money received from a seller, and set a seller's own rate. */
@Injectable()
export class AdminCommissionService {
  constructor(
    private readonly common: CommonCommissionService,
    private readonly disburse: AdminCommissionDisburseService,
  ) {}

  listBalances(query: ListBalanceQueryDto, pagination: CursorPagination) {
    return this.common.listBalances(query, pagination);
  }

  balance(sellerId: number) {
    return this.common.balanceFor(sellerId);
  }

  record(sellerId: number, dto: DisburseCommissionDto, files: Express.Multer.File[] | undefined, actor: Actor) {
    return this.disburse.record(sellerId, dto, files, actor);
  }

  listHistory(query: ListCommissionHistoryQueryDto, pagination: CursorPagination) {
    return this.common.listHistory(query, pagination);
  }

  listChanges(query: ListCommissionChangesQueryDto, pagination: CursorPagination) {
    return this.common.listChanges(query, pagination);
  }

  listDisbursements(query: ListDisburseQueryDto, pagination: CursorPagination) {
    return this.common.listDisburses(query, pagination);
  }

  disbursement(id: number) {
    return this.common.disburseDetails(id);
  }

  async setting(sellerId: number) {
    await this.common.assertSellerExists(sellerId);
    return this.common.commissionView(sellerId);
  }

  async setRule(sellerId: number, dto: SetSellerCommissionDto, actor: Actor) {
    await this.common.assertSellerExists(sellerId);
    await this.common.changeCommission(sellerId, { type: dto.commissionType, value: dto.commissionAmount }, actor, dto.note);
    return this.common.commissionView(sellerId);
  }

  settingHistory(query: ListSettingHistoryQueryDto, pagination: CursorPagination) {
    return this.common.listSettingHistory(query, pagination);
  }
}
