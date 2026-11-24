import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { SystemCommission } from '../../database/entities/commission/system-commission.entity';
import {
  SystemCommissionChangeHistory,
} from '../../database/entities/commission/system-commission-change-history.entity';
import { SystemCommissionHistory } from '../../database/entities/commission/system-commission-history.entity';
import { Order } from '../../database/entities/order/order.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CommissionHistoryType } from '../../database/enums/commission-history-type.enum';
import { CommissionStatus } from '../../database/enums/commission-status.enum';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { tidy } from '../../shared/utils/money.util';
import { assertValidRule, CommissionRule, lineCommission } from '../utils/commission-math.util';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SystemCommissionDisburse } from '../../database/entities/commission/system-commission-disburse.entity';
import {
  SystemCommissionDisburseAttachment,
} from '../../database/entities/commission/system-commission-disburse-attachment.entity';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import {
  ListBalanceQueryDto,
  ListCommissionChangesQueryDto,
  ListCommissionHistoryQueryDto,
  ListDisburseQueryDto,
  ListSettingHistoryQueryDto,
} from '../dtos/commission.dtos';
import { SellerSetting } from '../../database/entities/commission/seller-setting.entity';
import { SellerSettingHistory } from '../../database/entities/commission/seller-setting-history.entity';
import { SellerSettingType } from '../../database/enums/seller-setting-type.enum';
import { SystemSettingsService } from '../../settings/services/system-settings.service';
import { Actor } from '../../shared/types/actor.type';

/** Who caused the change. A guest customer has no id. */
export interface CommissionActor {
  id: number | null;
  type: AuthUserType;
  name: string;
}

export interface OrderCommission {
  // One entry per line, in the order the payables were given.
  lines: { commission: number; sellerAmount: number }[];
  // The sum of the lines.
  commission: number;
  sellerAmount: number;
  type: CommissionType;
  value: number;
}

export interface EffectiveCommission extends CommissionRule {
  // 'seller' when the seller has their own rule, 'global' when the system one applies.
  source: 'seller' | 'global';
}

const ZERO = { totalCommission: 0, dueCommission: 0, paidCommission: 0 };

/** The ledger row written together with a balance change. The balance after is filled in. */
export type LedgerRow = Omit<
  Partial<SystemCommissionHistory>,
  'totalAfter' | 'dueAfter' | 'paidAfter' | 'sellerId' | 'status'
> &
  Pick<SystemCommissionHistory, 'type' | 'totalAmount' | 'paymentStatus'>;

/**
 * Everything about commission that more than one role needs: works out an order's commission and keeps each seller's
 * balance, ledger and change log in step (every balance change goes through `post`, inside the caller's transaction and
 * under a lock on the seller's balance row), reads the balances, ledger, changes and payments, and keeps each seller's own
 * rate with its history. The admin and seller services call it.
 */
@Injectable()
export class CommonCommissionService {
  constructor(
    @InjectRepository(SystemCommission) private readonly balances: Repository<SystemCommission>,
    @InjectRepository(SystemCommissionHistory) private readonly history: Repository<SystemCommissionHistory>,
    @InjectRepository(SystemCommissionDisburse) private readonly disburses: Repository<SystemCommissionDisburse>,
    @InjectRepository(SystemCommissionDisburseAttachment)
    private readonly attachments: Repository<SystemCommissionDisburseAttachment>,
    @InjectRepository(SystemCommissionChangeHistory) private readonly changes: Repository<SystemCommissionChangeHistory>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(SellerSetting) private readonly sellerSettingRows: Repository<SellerSetting>,
    @InjectRepository(SellerSettingHistory) private readonly sellerSettingHistory: Repository<SellerSettingHistory>,
    private readonly system: SystemSettingsService,
  ) {}


  /**
   * Commission for a new order: the seller's own rule first, else the global one.
   * Each line gets its own commission; the order's is their sum.
   * `payable` is the whole order (lines plus delivery), for the seller's amount.
   */
  async forNewOrder(
    manager: EntityManager,
    sellerId: number,
    linePayables: number[],
    payable: number,
  ): Promise<OrderCommission> {
    const rule = await this.effective(sellerId, manager);
    const lines = linePayables.map((p) => {
      const commission = lineCommission(rule, p);
      return { commission, sellerAmount: tidy(p - commission) };
    });
    const commission = tidy(lines.reduce((n, l) => n + l.commission, 0));
    return { lines, commission, sellerAmount: tidy(payable - commission), type: rule.type, value: rule.value };
  }

  /** Makes sure the seller has a balance row, then locks it until the transaction ends. */
  async lockBalance(manager: EntityManager, sellerId: number): Promise<SystemCommission> {
    await manager.query(
      `INSERT INTO "system_commission" ("sellerId") VALUES ($1) ON CONFLICT ("sellerId") DO NOTHING`,
      [sellerId],
    );
    return manager
      .createQueryBuilder(SystemCommission, 'c')
      .setLock('pessimistic_write')
      .where('c.sellerId = :sellerId', { sellerId })
      .getOneOrFail();
  }

  /**
   * The one place a seller's balance changes. Adds `delta` to the three numbers,
   * writes the ledger row (when there is one) and the change-log row, and returns
   * the ledger row. The balance row must already be locked (see lockBalance).
   */
  async post(
    manager: EntityManager,
    balance: SystemCommission,
    delta: { total?: number; due?: number; paid?: number },
    status: CommissionStatus,
    actor: CommissionActor,
    options: { ledger?: LedgerRow; historyId?: number; note?: string | null } = {},
  ): Promise<SystemCommissionHistory | null> {
    const total = tidy(balance.totalCommission + (delta.total ?? 0));
    const due = tidy(balance.dueCommission + (delta.due ?? 0));
    const paid = tidy(balance.paidCommission + (delta.paid ?? 0));
    const stamp = { createdBy: actor.id, creatorType: actor.type, creatorName: actor.name };

    await manager.update(SystemCommission, balance.id, {
      totalCommission: total,
      dueCommission: due,
      paidCommission: paid,
      updatedBy: actor.id,
      updaterType: actor.type,
      updaterName: actor.name,
    });

    let row: SystemCommissionHistory | null = null;
    if (options.ledger) {
      row = await manager.save(SystemCommissionHistory, {
        ...stamp,
        ...options.ledger,
        sellerId: balance.sellerId,
        status,
        totalAfter: total,
        dueAfter: due,
        paidAfter: paid,
      });
    }
    await manager.save(SystemCommissionChangeHistory, {
      ...stamp,
      systemCommissionId: balance.id,
      sellerId: balance.sellerId,
      historyId: row?.id ?? options.historyId ?? null,
      currentTotalCommission: balance.totalCommission,
      currentDueCommission: balance.dueCommission,
      currentPaidCommission: balance.paidCommission,
      commissionStatus: status,
      newTotalCommission: total,
      newDueCommission: due,
      newPaidCommission: paid,
      note: options.note ?? null,
    });
    // Hand the new numbers back to the caller, which may post again on the same row.
    balance.totalCommission = total;
    balance.dueCommission = due;
    balance.paidCommission = paid;
    return row;
  }

  /**
   * An order has become fully paid: its commission is now earned. Adds it to the
   * balance and writes the ledger row. Does nothing when the commission is zero
   * or the order already has a live ledger row.
   */
  async earnFromOrder(manager: EntityManager, order: Order, actor: CommissionActor) {
    if (order.systemCommission <= 0) return;
    const balance = await this.lockBalance(manager, order.sellerId);
    const live = await manager.exists(SystemCommissionHistory, {
      where: { orderId: order.id, type: CommissionHistoryType.ORDER_COMMISSION, deletedAt: IsNull() },
    });
    if (live) return;

    await this.post(
      manager,
      balance,
      { total: order.systemCommission, due: order.systemCommission },
      CommissionStatus.FOR_SYSTEM,
      actor,
      {
        ledger: {
          orderId: order.id,
          type: CommissionHistoryType.ORDER_COMMISSION,
          totalAmount: order.systemCommission,
          orderSubtotal: order.subtotal,
          commissionType: order.commissionType,
          commissionValue: order.commissionValue,
          paymentStatus: PaymentStatus.PAID,
        },
      },
    );
  }

  /**
   * The order is no longer paid (payment reversed, or order cancelled): take its
   * commission back out. The ledger row is soft-deleted, never removed, and the
   * balance drops by exactly what the row added. Safe to call when there is no row.
   */
  async revokeFromOrder(manager: EntityManager, order: Order, reason: string, actor: CommissionActor) {
    const row = await manager.findOne(SystemCommissionHistory, {
      where: { orderId: order.id, type: CommissionHistoryType.ORDER_COMMISSION, deletedAt: IsNull() },
    });
    if (!row) return;
    const balance = await this.lockBalance(manager, order.sellerId);
    await this.post(
      manager,
      balance,
      { total: -row.totalAmount, due: -row.totalAmount },
      CommissionStatus.COMMISSION_VOIDED,
      actor,
      { historyId: row.id, note: reason },
    );
    await manager.update(SystemCommissionHistory, row.id, {
      voidReason: reason,
      updatedBy: actor.id,
      updaterType: actor.type,
      updaterName: actor.name,
    });
    await manager.softDelete(SystemCommissionHistory, row.id);
  }

  /**
   * A return reached `returned`: take the returned lines' commission back off the
   * balance. A whole-order return writes one ledger row; an item return writes one
   * per item, each with its item id. Does nothing when the order has no live
   * commission row (it never earned any). Returns the amount taken back.
   */
  async takeBackForReturn(
    manager: EntityManager,
    order: Order,
    returnId: number,
    wholeOrder: boolean,
    lines: { orderItemId: number; refundAmount: number; commissionAmount: number }[],
    actor: CommissionActor,
  ): Promise<number> {
    const earned = await manager.exists(SystemCommissionHistory, {
      where: { orderId: order.id, type: CommissionHistoryType.ORDER_COMMISSION, deletedAt: IsNull() },
    });
    if (!earned) return 0;
    const balance = await this.lockBalance(manager, order.sellerId);
    const rows = wholeOrder
      ? [
          {
            orderItemId: null as number | null,
            commission: tidy(lines.reduce((n, l) => n + l.commissionAmount, 0)),
            refund: tidy(lines.reduce((n, l) => n + l.refundAmount, 0)),
          },
        ]
      : lines.map((l) => ({ orderItemId: l.orderItemId as number | null, commission: l.commissionAmount, refund: l.refundAmount }));

    let taken = 0;
    for (const r of rows) {
      await this.post(
        manager,
        balance,
        { total: -r.commission, due: -r.commission },
        CommissionStatus.ORDER_RETURNED_TO_CUSTOMER,
        actor,
        {
          ledger: {
            orderId: order.id,
            orderItemId: r.orderItemId,
            orderReturnId: returnId,
            type: CommissionHistoryType.ORDER_RETURN,
            totalAmount: r.commission,
            orderSubtotal: r.refund,
            commissionType: order.commissionType,
            commissionValue: order.commissionValue,
            paymentStatus: PaymentStatus.PAID,
          },
        },
      );
      taken = tidy(taken + r.commission);
    }
    return taken;
  }

  /**
   * An admin moved a finished return back: earn its commission again. The return
   * ledger rows are soft-deleted (never removed) and the balance gets the amount back.
   */
  async undoReturn(manager: EntityManager, order: Order, returnId: number, reason: string, actor: CommissionActor) {
    const rows = await manager.find(SystemCommissionHistory, {
      where: { orderReturnId: returnId, type: CommissionHistoryType.ORDER_RETURN, deletedAt: IsNull() },
      order: { id: 'ASC' },
    });
    if (rows.length === 0) return;
    const balance = await this.lockBalance(manager, order.sellerId);
    for (const row of rows) {
      await this.post(
        manager,
        balance,
        { total: row.totalAmount, due: row.totalAmount },
        CommissionStatus.RETURN_UNDONE,
        actor,
        { historyId: row.id, note: reason },
      );
      await manager.update(SystemCommissionHistory, row.id, {
        voidReason: reason,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.softDelete(SystemCommissionHistory, row.id);
    }
  }

  // ---- reads for the admin and seller screens (a seller id limits every read to that seller) ----


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
    const rule = await this.commissionView(sellerId);
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

  // ---- per-seller settings (commission for now) and the history of every change ----


  async globalRule(): Promise<CommissionRule> {
    const [type, value] = await Promise.all([
      this.system.getString('commission.type'),
      this.system.getNumber('commission.amount'),
    ]);
    return { type: type as CommissionType, value };
  }

  /** The seller's own rule if there is one, otherwise the global one. */
  async effective(sellerId: number, manager?: EntityManager): Promise<EffectiveCommission> {
    const repo = manager ? manager.getRepository(SellerSetting) : this.sellerSettingRows;
    const own = await repo.findOne({ where: { sellerId, settingType: SellerSettingType.COMMISSION } });
    if (own?.commissionType && own.commissionAmount !== null) {
      return { type: own.commissionType, value: own.commissionAmount, source: 'seller' };
    }
    return { ...(await this.globalRule()), source: 'global' };
  }

  async commissionView(sellerId: number) {
    const own = await this.sellerSettingRows.findOne({ where: { sellerId, settingType: SellerSettingType.COMMISSION } });
    const effective = await this.effective(sellerId);
    return {
      sellerId,
      setting: own
        ? {
            id: own.id,
            settingType: own.settingType,
            commissionType: own.commissionType,
            commissionAmount: own.commissionAmount,
            updatedAt: own.updatedAt,
          }
        : null,
      global: await this.globalRule(),
      effective,
    };
  }

  async assertSellerExists(sellerId: number) {
    if (!(await this.sellers.exists({ where: { id: sellerId } }))) throw new NotFoundException('Seller not found');
  }

  /**
   * Create or change the seller's commission. Writes a history row when the
   * value really changes. Runs in the caller's transaction when one is given.
   */
  async setCommission(
    manager: EntityManager,
    sellerId: number,
    rule: CommissionRule,
    actor: Actor,
    note?: string | null,
  ) {
    assertValidRule(rule.type, rule.value);
    const repo = manager.getRepository(SellerSetting);
    const existing = await repo.findOne({
      where: { sellerId, settingType: SellerSettingType.COMMISSION },
      lock: { mode: 'pessimistic_write' },
    });
    const to = { commissionType: rule.type, commissionAmount: rule.value };
    const stamp = { updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name };
    const creator = { createdBy: actor.id, creatorType: actor.type, creatorName: actor.name };

    if (!existing) {
      const saved = await repo.save({
        ...creator,
        ...stamp,
        sellerId,
        settingType: SellerSettingType.COMMISSION,
        commissionType: rule.type,
        commissionAmount: rule.value,
      });
      await manager.save(SellerSettingHistory, {
        ...creator,
        sellerId,
        settingId: saved.id,
        settingType: SellerSettingType.COMMISSION,
        action: 'created',
        fromValue: null,
        toValue: to,
        note: note ?? null,
      });
      return saved;
    }
    if (existing.commissionType === rule.type && existing.commissionAmount === rule.value) return existing;

    const from = { commissionType: existing.commissionType, commissionAmount: existing.commissionAmount };
    await repo.update(existing.id, { ...stamp, commissionType: rule.type, commissionAmount: rule.value });
    await manager.save(SellerSettingHistory, {
      ...creator,
      sellerId,
      settingId: existing.id,
      settingType: SellerSettingType.COMMISSION,
      action: 'updated',
      fromValue: from,
      toValue: to,
      note: note ?? null,
    });
    return { ...existing, commissionType: rule.type, commissionAmount: rule.value };
  }

  /** setCommission in a transaction of its own. */
  changeCommission(sellerId: number, rule: CommissionRule, actor: Actor, note?: string | null) {
    return this.sellerSettingRows.manager.transaction((manager) => this.setCommission(manager, sellerId, rule, actor, note));
  }

  /** Every change to seller settings, newest first. A seller id limits it to one seller. */
  async listSettingHistory(query: ListSettingHistoryQueryDto, pagination: CursorPagination, sellerId?: number) {
    const qb = this.sellerSettingHistory
      .createQueryBuilder('h')
      .leftJoin(Seller, 's', 's.id = h."sellerId"')
      .select([
        'h.id AS id',
        'h."sellerId" AS "sellerId"',
        's.name AS "sellerName"',
        'h."settingType" AS "settingType"',
        'h.action AS action',
        'h."fromValue" AS "fromValue"',
        'h."toValue" AS "toValue"',
        'h.note AS note',
        'h."createdAt" AS "changedAt"',
        'h."createdBy" AS "changedBy"',
        'h."creatorType" AS "changedByType"',
        'h."creatorName" AS "changedByName"',
      ])
      .orderBy('h.id', 'DESC')
      .limit(pagination.limit);
    const scope = sellerId ?? query.sellerId;
    if (scope !== undefined) qb.andWhere('h."sellerId" = :scope', { scope });
    if (query.settingType) qb.andWhere('h."settingType" = :st', { st: query.settingType });
    if (query.from) qb.andWhere('h."createdAt" >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('h."createdAt" <= :to', { to: new Date(query.to) });
    if (pagination.cursor > 0) qb.andWhere('h.id < :cursor', { cursor: pagination.cursor });
    return getCursorPaginateData(await qb.getRawMany<{ id: number }>(), pagination.limit);
  }
}
