import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SellerSettingService } from './seller-setting.service';
import { Order } from '../../database/entities/order/order.entity';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SystemCommission } from '../../database/entities/commission/system-commission.entity';
import { SystemCommissionDisburse } from '../../database/entities/commission/system-commission-disburse.entity';
import { SystemCommissionDisburseAttachment } from '../../database/entities/commission/system-commission-disburse-attachment.entity';
import { SystemCommissionChangeHistory } from '../../database/entities/commission/system-commission-change-history.entity';
import { SystemCommissionHistory } from '../../database/entities/commission/system-commission-history.entity';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import {
  ListCommissionChangesQueryDto,
  ListBalanceQueryDto,
  ListCommissionHistoryQueryDto,
  ListDisburseQueryDto,
} from '../dtos/commission.dtos';

const ZERO = { totalCommission: 0, dueCommission: 0, paidCommission: 0 };

/** Reads for the admin and seller commission screens. A seller id scopes every read to that seller. */
@Injectable()
export class CommissionQueryService {
  constructor(
    @InjectRepository(SystemCommission) private readonly balances: Repository<SystemCommission>,
    @InjectRepository(SystemCommissionHistory) private readonly history: Repository<SystemCommissionHistory>,
    @InjectRepository(SystemCommissionDisburse) private readonly disburses: Repository<SystemCommissionDisburse>,
    @InjectRepository(SystemCommissionDisburseAttachment)
    private readonly attachments: Repository<SystemCommissionDisburseAttachment>,
    @InjectRepository(SystemCommissionChangeHistory) private readonly changes: Repository<SystemCommissionChangeHistory>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    private readonly sellerSettings: SellerSettingService,
  ) {}

  async listBalances(query: ListBalanceQueryDto, pagination: CursorPagination) {
    const qb = this.balances
      .createQueryBuilder('c')
      .innerJoin(Seller, 's', 's.id = c."sellerId"')
      .select([
        'c.id AS id',
        'c."sellerId" AS "sellerId"',
        's.name AS "sellerName"',
        's.phone AS "sellerPhone"',
        'c."totalCommission" AS "totalCommission"',
        'c."dueCommission" AS "dueCommission"',
        'c."paidCommission" AS "paidCommission"',
        'c."updatedAt" AS "updatedAt"',
      ])
      .orderBy('c.id', 'DESC')
      .limit(pagination.limit);
    if (query.sellerId !== undefined) qb.andWhere('c."sellerId" = :sid', { sid: query.sellerId });
    if (query.search) {
      qb.andWhere('(s.name ILIKE :q OR s.email ILIKE :q OR s.phone ILIKE :q)', { q: likeContains(query.search) });
    }
    if (query.status === 'due') qb.andWhere('c."dueCommission" > 0');
    if (query.status === 'cleared') qb.andWhere('c."dueCommission" <= 0');
    if (pagination.cursor > 0) qb.andWhere('c.id < :cursor', { cursor: pagination.cursor });
    return getCursorPaginateData(await qb.getRawMany<{ id: number }>(), pagination.limit);
  }

  /** One seller's balance, plus the commission rule that applies to them. */
  async balanceFor(sellerId: number) {
    const seller = await this.sellers.findOne({ where: { id: sellerId }, select: { id: true, name: true, phone: true } });
    if (!seller) throw new NotFoundException('Seller not found');
    const row = await this.balances.findOne({ where: { sellerId } });
    const rule = await this.sellerSettings.commissionView(sellerId);
    return {
      sellerId,
      sellerName: seller.name,
      sellerPhone: seller.phone,
      totalCommission: row?.totalCommission ?? ZERO.totalCommission,
      dueCommission: row?.dueCommission ?? ZERO.dueCommission,
      paidCommission: row?.paidCommission ?? ZERO.paidCommission,
      updatedAt: row?.updatedAt ?? null,
      commission: { setting: rule.setting, global: rule.global, effective: rule.effective },
    };
  }

  async listHistory(query: ListCommissionHistoryQueryDto, pagination: CursorPagination, sellerId?: number) {
    const qb = this.history
      .createQueryBuilder('h')
      .withDeleted()
      .leftJoin(Seller, 's', 's.id = h."sellerId"')
      .leftJoin(Order, 'o', 'o.id = h."orderId"')
      .select([
        'h.id AS id',
        'h."sellerId" AS "sellerId"',
        's.name AS "sellerName"',
        'h."orderId" AS "orderId"',
        'o."orderNumber" AS "orderNumber"',
        'h."disburseId" AS "disburseId"',
        'h."orderItemId" AS "orderItemId"',
        'h."orderReturnId" AS "orderReturnId"',
        'h.status AS status',
        'h.type AS type',
        'h."totalAmount" AS "totalAmount"',
        'h."orderSubtotal" AS "orderSubtotal"',
        'h."commissionType" AS "commissionType"',
        'h."commissionValue" AS "commissionValue"',
        'h."paymentStatus" AS "paymentStatus"',
        'h."totalAfter" AS "totalAfter"',
        'h."dueAfter" AS "dueAfter"',
        'h."paidAfter" AS "paidAfter"',
        'h."createdAt" AS "createdAt"',
        'h."deletedAt" AS "voidedAt"',
        'h."voidReason" AS "voidReason"',
      ])
      .orderBy('h.id', 'DESC')
      .limit(pagination.limit);
    this.scopeHistory(qb, query, sellerId);
    if (pagination.cursor > 0) qb.andWhere('h.id < :cursor', { cursor: pagination.cursor });
    return getCursorPaginateData(await qb.getRawMany<{ id: number }>(), pagination.limit);
  }

  private scopeHistory(qb: SelectQueryBuilder<SystemCommissionHistory>, q: ListCommissionHistoryQueryDto, sellerId?: number) {
    const sid = sellerId ?? q.sellerId;
    if (sid !== undefined) qb.andWhere('h."sellerId" = :sid', { sid });
    if (q.orderId !== undefined) qb.andWhere('h."orderId" = :oid', { oid: q.orderId });
    if (q.type) qb.andWhere('h.type = :type', { type: q.type });
    if (q.status) qb.andWhere('h.status = :status', { status: q.status });
    if (q.paymentStatus) qb.andWhere('h."paymentStatus" = :ps', { ps: q.paymentStatus });
    if (q.from) qb.andWhere('h."createdAt" >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('h."createdAt" <= :to', { to: new Date(q.to) });
    if (q.voided === 'true') qb.andWhere('h."deletedAt" IS NOT NULL');
    if (q.voided === 'false') qb.andWhere('h."deletedAt" IS NULL');
  }

  /** Every change to a seller's balance, newest first: what it was, what it became, and why. */
  async listChanges(query: ListCommissionChangesQueryDto, pagination: CursorPagination, sellerId?: number) {
    const qb = this.changes
      .createQueryBuilder('c')
      .leftJoin(Seller, 's', 's.id = c."sellerId"')
      .leftJoin(SystemCommissionHistory, 'h', 'h.id = c."historyId"')
      .withDeleted()
      .select([
        'c.id AS id',
        'c."systemCommissionId" AS "systemCommissionId"',
        'c."sellerId" AS "sellerId"',
        's.name AS "sellerName"',
        'c."historyId" AS "historyId"',
        'h."orderId" AS "orderId"',
        'h."orderItemId" AS "orderItemId"',
        'h."orderReturnId" AS "orderReturnId"',
        'c."commissionStatus" AS "commissionStatus"',
        'c."currentTotalCommission" AS "currentTotalCommission"',
        'c."currentDueCommission" AS "currentDueCommission"',
        'c."currentPaidCommission" AS "currentPaidCommission"',
        'c."newTotalCommission" AS "newTotalCommission"',
        'c."newDueCommission" AS "newDueCommission"',
        'c."newPaidCommission" AS "newPaidCommission"',
        'c.note AS note',
        'c."creatorName" AS "creatorName"',
        'c."creatorType" AS "creatorType"',
        'c."createdAt" AS "createdAt"',
      ])
      .orderBy('c.id', 'DESC')
      .limit(pagination.limit);
    const sid = sellerId ?? query.sellerId;
    if (sid !== undefined) qb.andWhere('c."sellerId" = :sid', { sid });
    if (query.status) qb.andWhere('c."commissionStatus" = :status', { status: query.status });
    if (query.from) qb.andWhere('c."createdAt" >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('c."createdAt" <= :to', { to: new Date(query.to) });
    if (pagination.cursor > 0) qb.andWhere('c.id < :cursor', { cursor: pagination.cursor });
    return getCursorPaginateData(await qb.getRawMany<{ id: number }>(), pagination.limit);
  }

  async listDisburses(query: ListDisburseQueryDto, pagination: CursorPagination, sellerId?: number) {
    const qb = this.disburses
      .createQueryBuilder('d')
      .leftJoin(Seller, 's', 's.id = d."sellerId"')
      .select([
        'd.id AS id',
        'd."sellerId" AS "sellerId"',
        's.name AS "sellerName"',
        'd.amount AS amount',
        'd.notes AS notes',
        'd."totalAmount" AS "totalAmount"',
        'd."dueAmount" AS "dueAmount"',
        'd."paidAmount" AS "paidAmount"',
        'd."createdAt" AS "createdAt"',
        'd."creatorName" AS "recordedByName"',
        '(SELECT COUNT(*)::int FROM system_commission_disburse_attachments a WHERE a."disburseId" = d.id AND a."deletedAt" IS NULL) AS "attachmentCount"',
      ])
      .orderBy('d.id', 'DESC')
      .limit(pagination.limit);
    const sid = sellerId ?? query.sellerId;
    if (sid !== undefined) qb.andWhere('d."sellerId" = :sid', { sid });
    if (query.from) qb.andWhere('d."createdAt" >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('d."createdAt" <= :to', { to: new Date(query.to) });
    if (query.minAmount !== undefined) qb.andWhere('d.amount >= :min', { min: query.minAmount });
    if (query.maxAmount !== undefined) qb.andWhere('d.amount <= :max', { max: query.maxAmount });
    if (pagination.cursor > 0) qb.andWhere('d.id < :cursor', { cursor: pagination.cursor });
    return getCursorPaginateData(await qb.getRawMany<{ id: number }>(), pagination.limit);
  }

  async disburseDetails(id: number, sellerId?: number) {
    const row = await this.disburses.findOne({
      where: { id, ...(sellerId !== undefined ? { sellerId } : {}) },
    });
    if (!row) throw new NotFoundException('Commission payment not found');
    const seller = await this.sellers.findOne({ where: { id: row.sellerId }, select: { id: true, name: true } });
    const files = await this.attachments.find({ where: { disburseId: id }, order: { id: 'ASC' } });
    return {
      id: row.id,
      sellerId: row.sellerId,
      sellerName: seller?.name ?? null,
      amount: row.amount,
      notes: row.notes,
      totalAmount: row.totalAmount,
      dueAmount: row.dueAmount,
      paidAmount: row.paidAmount,
      createdAt: row.createdAt,
      recordedByName: row.creatorName,
      attachments: files.map((f) => ({
        id: f.id,
        kind: f.kind,
        fileName: f.fileName,
        url: f.fileUrl,
        mimeType: f.mimeType,
        size: f.size,
      })),
    };
  }
}
