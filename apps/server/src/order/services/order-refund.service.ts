import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { Order } from '../../database/entities/order/order.entity';
import { OrderRefund } from '../../database/entities/order/order-refund.entity';
import { OrderRefundStatusHistory } from '../../database/entities/order/order-refund-status-history.entity';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { RefundKind, RefundStatus } from '../../database/enums/refund-status.enum';
import { sameMoney } from '../../shared/utils/money.util';
import { refundRecordView } from '../utils/refund-view.util';
import { StoredAttachment } from './order-file.service';
import { StatusActor } from './order-status.service';

/**
 * The core of "money back for a cancelled order". When an order that has received money is cancelled, a refund
 * record is opened (needs_to_refund). `order.refundStatus` always mirrors the latest cancelled-order record.
 */
@Injectable()
export class OrderRefundService {
  constructor(private readonly db: DatabaseService) {}

  /** The order was just cancelled. If money was paid, open a refund record for it. */
  async openOnCancel(manager: EntityManager, order: Order, actor: StatusActor) {
    const held = order.amountPaid > 0 && (order.paymentStatus === PaymentStatus.PAID || order.paymentStatus === PaymentStatus.PARTIALLY_PAID);
    if (!held) return null;
    const refund = await manager.save(OrderRefund, {
      orderId: order.id,
      sellerId: order.sellerId,
      userId: order.userId,
      kind: RefundKind.CANCELLED_ORDER,
      status: RefundStatus.NEEDS_TO_REFUND,
      expectedAmount: order.amountPaid,
      note: 'The order was cancelled',
      createdBy: actor.id,
      creatorType: actor.type,
      creatorName: actor.name,
    });
    await this.log(manager, refund, null, RefundStatus.NEEDS_TO_REFUND, 'The order was cancelled', null, [], actor);
    await manager.update(Order, order.id, { refundStatus: RefundStatus.NEEDS_TO_REFUND });
    return refund;
  }

  /**
   * A cancelled order is being reopened. If its money is already being sent back or was sent back, it cannot be
   * reopened until an admin has looked at the refund. If nothing was sent yet, the open record is voided.
   */
  async closeOnReopen(manager: EntityManager, order: Order, actor: StatusActor) {
    if (order.refundStatus === RefundStatus.PROCESSING || order.refundStatus === RefundStatus.REFUNDED) {
      throw new ConflictException('The money for this order is being sent back, or was sent back. Change the refund first, then reopen the order.');
    }
    const open = await manager.find(OrderRefund, { where: { orderId: order.id, kind: RefundKind.CANCELLED_ORDER, status: RefundStatus.NEEDS_TO_REFUND } });
    for (const r of open) {
      await manager.update(OrderRefund, r.id, { status: RefundStatus.VOIDED });
      await this.log(manager, r, r.status, RefundStatus.VOIDED, 'The order was reopened, so no refund is needed', null, [], actor);
    }
    await this.syncOrder(manager, order.id);
  }

  /** Points `order.refundStatus` at the latest cancelled-order record that still counts. */
  async syncOrder(manager: EntityManager, orderId: number) {
    const [latest] = await manager.query<{ status: RefundStatus }[]>(
      `select status from order_refund where "orderId" = $1 and kind = 'cancelled_order' and status <> 'voided' and "deletedAt" is null order by id desc limit 1`,
      [orderId],
    );
    await manager.update(Order, orderId, { refundStatus: latest?.status ?? null });
  }

  async log(manager: EntityManager, refund: OrderRefund, from: RefundStatus | null, to: RefundStatus, note: string | null, amount: number | null, attachments: StoredAttachment[], actor: StatusActor) {
    await manager.save(OrderRefundStatusHistory, {
      orderRefundId: refund.id,
      orderId: refund.orderId,
      fromStatus: from,
      status: to,
      note,
      amount,
      attachments,
      createdBy: actor.id,
      creatorType: actor.type,
      creatorName: actor.name,
    });
  }

  /** The amount must be what the buyer paid on the order. Anything else is refused. */
  assertAmountMatches(order: Pick<Order, 'amountPaid'>, amount: number | undefined, expected?: number) {
    const paid = expected ?? order.amountPaid;
    if (amount === undefined) throw new BadRequestException('Enter the amount you sent back');
    if (paid <= 0) throw new ConflictException('No money is held on this order, so there is nothing to refund');
    if (!sameMoney(amount, paid)) throw new BadRequestException(`The refund amount must be exactly what the buyer paid (${paid}). You entered ${amount}.`);
  }

  /** Every record on an order, newest first, with histories. */
  async forOrder(orderId: number) {
    const rows = await this.db.orderRefund.find({ where: { orderId }, relations: { history: true }, order: { id: 'DESC' } });
    return rows.map((r) => refundRecordView(r));
  }

}
