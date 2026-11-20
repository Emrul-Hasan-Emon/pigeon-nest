import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { Order } from '../../database/entities/order/order.entity';
import { OrderItem } from '../../database/entities/order/order-item.entity';
import { OrderStatusHistory } from '../../database/entities/order/order-status-history.entity';
import { SellerProductSku } from '../../database/entities/product/seller-product-sku.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { transitionDenied } from '../utils/order-status-rules';

/** Who is changing the status. A guest customer has no id. */
export interface StatusActor {
  id: number | null;
  type: AuthUserType;
  name: string;
}

/** Limits the order lookup, so someone else's order is "not found", not "forbidden". */
export interface OrderScope {
  sellerId?: number;
  userId?: number;
  guestSessionId?: string;
}

export interface StatusChange {
  orderId: number;
  from: OrderStatus;
  to: OrderStatus;
}

/**
 * The one place an order's status changes. It checks who may make the move,
 * keeps stock in step (cancelling gives it back, reopening takes it again) and
 * writes the history row, all in one transaction.
 */
@Injectable()
export class OrderStatusService {
  constructor(private readonly db: DatabaseService) {}

  async change(
    orderId: number,
    to: OrderStatus,
    actor: StatusActor,
    options: { note?: string | null; scope?: OrderScope } = {},
  ): Promise<StatusChange> {
    return this.db.order.manager.transaction(async (manager) => {
      const qb = manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId });
      const scope = options.scope ?? {};
      if (scope.sellerId !== undefined) qb.andWhere('o.sellerId = :sellerId', { sellerId: scope.sellerId });
      if (scope.userId !== undefined) qb.andWhere('o.userId = :userId', { userId: scope.userId });
      if (scope.guestSessionId !== undefined) {
        qb.andWhere('o.guestSessionId = :guestSessionId', { guestSessionId: scope.guestSessionId });
      }
      const order = await qb.getOne();
      if (!order) throw new NotFoundException('Order not found');

      const from = order.status;
      const denied = transitionDenied(actor.type, from, to);
      if (denied) throw new ForbiddenException(denied);

      const items = await manager.find(OrderItem, { where: { orderId: order.id } });
      if (to === OrderStatus.CANCELLED) await this.giveBack(manager, items);
      else if (from === OrderStatus.CANCELLED) await this.takeAgain(manager, items);

      await manager.update(Order, order.id, {
        status: to,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.save(OrderStatusHistory, {
        orderId: order.id,
        fromStatus: from,
        status: to,
        note: options.note?.trim() || null,
        createdBy: actor.id,
        creatorType: actor.type,
        creatorName: actor.name,
      });
      return { orderId: order.id, from, to };
    });
  }

  /** Put the ordered quantities back on the shelf. */
  private async giveBack(manager: EntityManager, items: OrderItem[]) {
    for (const [skuId, quantity] of this.bySku(items)) {
      await manager
        .createQueryBuilder()
        .update(SellerProductSku)
        .set({ quantity: () => `"quantity" + ${quantity}` })
        .where('id = :skuId', { skuId })
        .execute();
    }
  }

  /** Reopening a cancelled order takes the stock again, or fails if it is gone. */
  private async takeAgain(manager: EntityManager, items: OrderItem[]) {
    for (const [skuId, quantity] of this.bySku(items)) {
      const result = await manager
        .createQueryBuilder()
        .update(SellerProductSku)
        .set({ quantity: () => `"quantity" - ${quantity}` })
        .where('id = :skuId AND quantity >= :quantity', { skuId, quantity })
        .execute();
      if (!result.affected) {
        const name = items.find((i) => i.sellerProductSkuId === skuId)?.productName ?? 'An item';
        throw new ConflictException(`Not enough stock to reopen this order: ${name}`);
      }
    }
  }

  /** Quantities per SKU in id order, so concurrent updates lock rows in one order. */
  private bySku(items: OrderItem[]): [number, number][] {
    const totals = new Map<number, number>();
    for (const item of items) {
      totals.set(item.sellerProductSkuId, (totals.get(item.sellerProductSkuId) ?? 0) + item.quantity);
    }
    return [...totals.entries()].sort((a, b) => a[0] - b[0]);
  }
}
