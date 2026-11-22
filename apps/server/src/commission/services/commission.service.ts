import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { SellerSettingService } from './seller-setting.service';
import { SystemCommission } from '../../database/entities/commission/system-commission.entity';
import { SystemCommissionChangeHistory } from '../../database/entities/commission/system-commission-change-history.entity';
import { SystemCommissionHistory } from '../../database/entities/commission/system-commission-history.entity';
import { Order } from '../../database/entities/order/order.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CommissionHistoryType } from '../../database/enums/commission-history-type.enum';
import { CommissionStatus } from '../../database/enums/commission-status.enum';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { tidy } from '../../shared/utils/money.util';
import { lineCommission } from '../utils/commission-math.util';

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

/** The ledger row written together with a balance change. The balance after is filled in. */
export type LedgerRow = Omit<
  Partial<SystemCommissionHistory>,
  'totalAfter' | 'dueAfter' | 'paidAfter' | 'sellerId' | 'status'
> &
  Pick<SystemCommissionHistory, 'type' | 'totalAmount' | 'paymentStatus'>;

/**
 * Works out the commission of an order, and keeps the seller's commission
 * balance, its ledger and its change log in step. Every balance change goes
 * through `post`, inside the caller's transaction and under a lock on the
 * seller's balance row, so nothing can move a balance without leaving a trace.
 */
@Injectable()
export class CommissionService {
  constructor(
    private readonly sellerSettings: SellerSettingService,
    @InjectRepository(SystemCommission) private readonly balances: Repository<SystemCommission>,
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
    const rule = await this.sellerSettings.effective(sellerId, manager);
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
}
