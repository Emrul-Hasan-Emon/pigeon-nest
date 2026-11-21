import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { SellerSettingService } from './seller-setting.service';
import { SystemCommission } from '../../database/entities/commission/system-commission.entity';
import { SystemCommissionHistory } from '../../database/entities/commission/system-commission-history.entity';
import { Order } from '../../database/entities/order/order.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CommissionHistoryType } from '../../database/enums/commission-history-type.enum';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { tidy } from '../../shared/utils/money.util';
import { commissionFor } from '../utils/commission-math.util';

/** Who caused the change. A guest customer has no id. */
export interface CommissionActor {
  id: number | null;
  type: AuthUserType;
  name: string;
}

export interface OrderCommission {
  commission: number;
  sellerAmount: number;
  type: CommissionType;
  value: number;
}

/**
 * Works out the commission of an order, and keeps the seller's commission
 * balance and ledger in step with it. Every balance change goes through here,
 * inside the caller's transaction and under a lock on the seller's balance row.
 */
@Injectable()
export class CommissionService {
  constructor(
    private readonly sellerSettings: SellerSettingService,
    @InjectRepository(SystemCommission) private readonly balances: Repository<SystemCommission>,
  ) {}

  /** Commission for a new order: the seller's own rule first, else the global one. */
  async forNewOrder(
    manager: EntityManager,
    sellerId: number,
    subtotal: number,
    payable: number,
  ): Promise<OrderCommission> {
    const rule = await this.sellerSettings.effective(sellerId, manager);
    const { commission, sellerAmount } = commissionFor(rule, subtotal, payable);
    return { commission, sellerAmount, type: rule.type, value: rule.value };
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

    const total = tidy(balance.totalCommission + order.systemCommission);
    const due = tidy(balance.dueCommission + order.systemCommission);
    await manager.update(SystemCommission, balance.id, {
      totalCommission: total,
      dueCommission: due,
      updatedBy: actor.id,
      updaterType: actor.type,
      updaterName: actor.name,
    });
    await manager.save(SystemCommissionHistory, {
      createdBy: actor.id,
      creatorType: actor.type,
      creatorName: actor.name,
      sellerId: order.sellerId,
      orderId: order.id,
      type: CommissionHistoryType.ORDER_COMMISSION,
      totalAmount: order.systemCommission,
      orderSubtotal: order.subtotal,
      commissionType: order.commissionType,
      commissionValue: order.commissionValue,
      paymentStatus: PaymentStatus.PAID,
      totalAfter: total,
      dueAfter: due,
      paidAfter: balance.paidCommission,
    });
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
    const total = tidy(balance.totalCommission - row.totalAmount);
    const due = tidy(balance.dueCommission - row.totalAmount);
    await manager.update(SystemCommission, balance.id, {
      totalCommission: total,
      dueCommission: due,
      updatedBy: actor.id,
      updaterType: actor.type,
      updaterName: actor.name,
    });
    await manager.update(SystemCommissionHistory, row.id, {
      voidReason: reason,
      updatedBy: actor.id,
      updaterType: actor.type,
      updaterName: actor.name,
    });
    await manager.softDelete(SystemCommissionHistory, row.id);
  }
}
