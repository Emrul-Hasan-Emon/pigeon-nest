import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CommonCommissionService } from '../../commission/services/common-commission.service';
import { DatabaseService } from '../../database/database.service';
import { Order } from '../../database/entities/order/order.entity';
import { OrderItem } from '../../database/entities/order/order-item.entity';
import { OrderReturn } from '../../database/entities/order-return/order-return.entity';
import { OrderReturnAttachment } from '../../database/entities/order-return/order-return-attachment.entity';
import { OrderReturnItem } from '../../database/entities/order-return/order-return-item.entity';
import { OrderReturnStatusHistory } from '../../database/entities/order-return/order-return-status-history.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { ReturnReasonCode } from '../../database/enums/return-reason-code.enum';
import { ReturnScope } from '../../database/enums/return-scope.enum';
import { OPEN_RETURN_STATUSES, ReturnStatus } from '../../database/enums/return-status.enum';
import { OrderFileService, StoredAttachment } from '../../order/services/order-file.service';
import { SystemSettingsService } from '../../settings/services/system-settings.service';
import { Actor } from '../../shared/types/actor.type';
import { tidy } from '../../shared/utils/money.util';
import { AdminCreateReturnDto, CreateReturnDto } from '../dtos/returns.dtos';

const FOLDER = 'order-returns';

/** What the customer paid for one line. */
const linePayable = (i: OrderItem): number => tidy(i.totalProposalPrice ?? i.totalDiscountedPrice ?? i.totalPrice);

type Who = 'user' | 'admin';

/**
 * The rules every role shares: what can be returned, opening a return, and one
 * locked move of a return (money, flags, commission, status, history, files).
 * Who may make which move lives in the user, seller and admin services.
 *
 * Returns and refunds. A return covers a whole order or some items; the seller
 * accepts or rejects, then walks it through processing and returning the money,
 * and an admin confirms it as returned. Confirming takes the lines' commission
 * back off the seller. Every move is one transaction under a lock on the order.
 */
@Injectable()
export class CommonReturnService {
  constructor(
    private readonly db: DatabaseService,
    private readonly commission: CommonCommissionService,
    private readonly settings: SystemSettingsService,
    private readonly files: OrderFileService,
  ) {}

  // ---------------------------------------------------------------- rules

  private async deliveredAt(manager: EntityManager, orderId: number): Promise<Date | null> {
    const [row]: { at: Date | null }[] = await manager.query(
      `SELECT MAX("createdAt") AS at FROM order_status_history WHERE "orderId" = $1 AND status = $2 AND "deletedAt" IS NULL`,
      [orderId, OrderStatus.DELIVERED],
    );
    return row?.at ?? null;
  }

  /**
   * What can be returned on this order right now, and why not when it cannot.
   * A customer gets one request per order or item for good (any outcome counts).
   * An admin may open another while the goods are not returned and nothing else is open on them.
   */
  async assess(manager: EntityManager, order: Order, who: Who) {
    const items = await manager.find(OrderItem, { where: { orderId: order.id }, order: { id: 'ASC' } });
    const rows: { id: number; status: ReturnStatus; orderItemId: number }[] = await manager.query(
      `SELECT r.id, r.status, ri."orderItemId" FROM order_return r
         JOIN order_return_item ri ON ri."orderReturnId" = r.id AND ri."deletedAt" IS NULL
        WHERE r."orderId" = $1 AND r."deletedAt" IS NULL`,
      [order.id],
    );
    const windowDays = await this.settings.getNumber('returns.windowDays');
    const deliveredAt = await this.deliveredAt(manager, order.id);
    const windowEndsAt = windowDays > 0 && deliveredAt ? new Date(deliveredAt.getTime() + windowDays * 86_400_000) : null;

    let orderBlock: string | null = null;
    if (order.paymentStatus !== PaymentStatus.PAID) orderBlock = 'Only fully paid orders can be returned';
    else if (order.status !== OrderStatus.DELIVERED) orderBlock = 'Only delivered orders can be returned';
    else if (who === 'user' && windowEndsAt && windowEndsAt.getTime() < Date.now()) {
      orderBlock = `The return window of ${windowDays} days has ended`;
    }

    const itemReason = (i: OrderItem): string | null => {
      if (orderBlock) return orderBlock;
      if (i.isReturned) return 'This item was already returned';
      const mine = rows.filter((r) => r.orderItemId === i.id);
      if (who === 'user' && mine.length > 0) return 'A return was already requested for this item';
      if (mine.some((r) => OPEN_RETURN_STATUSES.includes(r.status))) return 'This item is already in an open return';
      return null;
    };
    const itemStates = items.map((i) => ({ item: i, reason: itemReason(i) }));

    const remaining = items.filter((i) => !i.isReturned);
    let fullReason: string | null = orderBlock;
    if (!fullReason) {
      if (order.isReturned || remaining.length === 0) fullReason = 'This order was already returned';
      else if (who === 'user' && rows.length > 0) {
        fullReason = 'A return was already requested for this order or one of its items';
      } else if (rows.some((r) => OPEN_RETURN_STATUSES.includes(r.status))) {
        fullReason = 'A return is already open on this order';
      }
    }
    return { items: itemStates, remaining, fullReason, windowDays, windowEndsAt, deliveredAt };
  }

  /** Eligibility for the order screens: what may be returned and what it would refund. */
  async eligibility(orderId: number, who: Who, userId?: number) {
    const order = await this.db.order.findOne({ where: { id: orderId } });
    if (!order || (who === 'user' && order.userId !== userId)) throw new NotFoundException('Order not found');
    const a = await this.assess(this.db.order.manager, order, who);
    const defaultDelivery = await this.settings.getBoolean('returns.refundDeliveryCharge');
    const itemsAmount = tidy(a.remaining.reduce((n, i) => n + linePayable(i), 0));
    return {
      orderId,
      orderNumber: order.orderNumber,
      returnWindowDays: a.windowDays,
      windowEndsAt: a.windowEndsAt,
      fullOrder: {
        allowed: a.fullReason === null,
        reason: a.fullReason,
        itemsAmount,
        deliveryCharge: order.deliveryCharge,
        includeDeliveryCharge: defaultDelivery,
        refundAmount: tidy(itemsAmount + (defaultDelivery ? order.deliveryCharge : 0)),
      },
      items: a.items.map(({ item, reason }) => ({
        orderItemId: item.id,
        productName: item.productName,
        quantity: item.quantity,
        refundAmount: linePayable(item),
        allowed: reason === null,
        reason,
      })),
    };
  }

  // ---------------------------------------------------------------- create

  /** A customer, or an admin for a customer, opens a return. Returns the new return's id. */
  async create(
    dto: CreateReturnDto | AdminCreateReturnDto,
    uploads: Express.Multer.File[] | undefined,
    actor: Actor,
  ) {
    const who: Who = actor.type === AuthUserType.ADMIN ? 'admin' : 'user';
    const list = this.files.validate(uploads);
    const stored = await this.files.store(list, FOLDER);
    try {
      return await this.db.order.manager.transaction(async (manager) => {
        const order = await this.lockOrder(manager, dto.orderId);
        if (!order || (who === 'user' && order.userId !== actor.id)) throw new NotFoundException('Order not found');

        const a = await this.assess(manager, order, who);
        const ids = dto.scope === ReturnScope.ITEMS ? (dto.orderItemIds ?? []) : [];
        if (dto.scope === ReturnScope.FULL_ORDER && dto.orderItemIds?.length) {
          throw new BadRequestException('orderItemIds is only for item returns');
        }

        let chosen: OrderItem[];
        if (dto.scope === ReturnScope.FULL_ORDER) {
          if (a.fullReason) throw new ConflictException(a.fullReason);
          chosen = a.remaining;
        } else {
          const byId = new Map(a.items.map((s) => [s.item.id, s]));
          chosen = ids.map((itemId) => {
            const state = byId.get(itemId);
            if (!state) throw new BadRequestException(`Item ${itemId} is not on this order`);
            if (state.reason) throw new ConflictException(`${state.item.productName}: ${state.reason}`);
            return state.item;
          });
        }

        const defaultDelivery = await this.settings.getBoolean('returns.refundDeliveryCharge');
        const includeDelivery =
          dto.scope === ReturnScope.FULL_ORDER
            ? ((dto as AdminCreateReturnDto).includeDeliveryCharge ?? defaultDelivery)
            : false;
        if (dto.scope === ReturnScope.ITEMS && (dto as AdminCreateReturnDto).includeDeliveryCharge) {
          throw new BadRequestException('The delivery charge is only refunded on a full-order return');
        }

        const itemsAmount = tidy(chosen.reduce((n, i) => n + linePayable(i), 0));
        const deliveryAmount = includeDelivery ? tidy(order.deliveryCharge) : 0;
        const stamp = { createdBy: actor.id, creatorType: actor.type, creatorName: actor.name };

        const ret = await manager.save(OrderReturn, {
          ...stamp,
          returnNumber: await this.newNumber(manager),
          orderId: order.id,
          userId: order.userId,
          sellerId: order.sellerId,
          status: ReturnStatus.RETURN_REQUESTED,
          scope: dto.scope,
          reason: dto.reason,
          reasonCode: dto.reasonCode ?? ReturnReasonCode.OTHER,
          includeDeliveryCharge: includeDelivery,
          itemsAmount,
          deliveryAmount,
          refundAmount: tidy(itemsAmount + deliveryAmount),
          commissionAmount: tidy(chosen.reduce((n, i) => n + i.systemCommission, 0)),
        });
        await manager.save(
          OrderReturnItem,
          chosen.map((i) => ({
            ...stamp,
            orderReturnId: ret.id,
            orderItemId: i.id,
            quantity: i.quantity,
            refundAmount: linePayable(i),
            commissionAmount: i.systemCommission,
            reason: null,
          })),
        );
        const history = await manager.save(OrderReturnStatusHistory, {
          ...stamp,
          orderReturnId: ret.id,
          fromStatus: null,
          status: ReturnStatus.RETURN_REQUESTED,
          note: null,
        });
        await this.saveAttachments(manager, ret.id, history.id, stored, actor);
        return ret.id;
      });
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
  }

  // ------------------------------------------------------------ transitions

  /**
   * One locked move. Order row first, then the return, so two moves on the same
   * order always queue in the same order. `decide` checks the move and says where to go.
   */
  async transition(
    id: number,
    scope: { userId?: number; sellerId?: number },
    actor: Actor,
    decide: (ret: OrderReturn) => Promise<{
      to: ReturnStatus;
      note: string | null | undefined;
      includeDeliveryCharge?: boolean;
      files?: StoredAttachment[];
    }>,
  ) {
    await this.db.order.manager.transaction(async (manager) => {
      const probe = await manager.findOne(OrderReturn, { where: { id } });
      if (
        !probe ||
        (scope.userId !== undefined && probe.userId !== scope.userId) ||
        (scope.sellerId !== undefined && probe.sellerId !== scope.sellerId)
      ) {
        throw new NotFoundException('Return not found');
      }
      const order = await this.lockOrder(manager, probe.orderId);
      const ret = await manager
        .createQueryBuilder(OrderReturn, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOneOrFail();
      if (!order) throw new NotFoundException('Order not found');

      const move = await decide(ret);
      await this.apply(manager, order, ret, move.to, actor, move);
    });
  }

  /** Does the move: money, flags, commission, status, history row, files. */
  private async apply(
    manager: EntityManager,
    order: Order,
    ret: OrderReturn,
    to: ReturnStatus,
    actor: Actor,
    options: { note?: string | null; includeDeliveryCharge?: boolean; files?: StoredAttachment[] },
  ) {
    const from = ret.status;
    const lines = await manager.find(OrderReturnItem, { where: { orderReturnId: ret.id }, order: { id: 'ASC' } });
    const itemIds = lines.map((l) => l.orderItemId);
    const held = (s: ReturnStatus) => OPEN_RETURN_STATUSES.includes(s) || s === ReturnStatus.RETURNED;

    // Coming back from rejected or cancelled: the goods must still be free.
    if (!held(from) && held(to)) {
      const clash: { returnNumber: string }[] = await manager.query(
        `SELECT DISTINCT r."returnNumber" FROM order_return r
           JOIN order_return_item ri ON ri."orderReturnId" = r.id AND ri."deletedAt" IS NULL
          WHERE ri."orderItemId" = ANY($1) AND r.id <> $2 AND r."deletedAt" IS NULL
            AND r.status IN ('return_requested','accepted','processing','returning_money','returned')`,
        [itemIds, ret.id],
      );
      if (clash.length > 0) {
        throw new ConflictException(`Those items are already in return ${clash[0].returnNumber}`);
      }
    }

    // The delivery-charge choice: only a full-order return, and only before it is finished.
    let includeDelivery = ret.includeDeliveryCharge;
    if (options.includeDeliveryCharge !== undefined && options.includeDeliveryCharge !== includeDelivery) {
      if (ret.scope !== ReturnScope.FULL_ORDER) throw new BadRequestException('Only full-order returns can include delivery');
      if (from === ReturnStatus.RETURNED && to === ReturnStatus.RETURNED) {
        throw new ConflictException('A finished return cannot change its refund');
      }
      includeDelivery = options.includeDeliveryCharge;
    }
    const deliveryAmount = includeDelivery ? tidy(order.deliveryCharge) : 0;
    const refundAmount = tidy(ret.itemsAmount + deliveryAmount);

    const patch: QueryDeepPartialEntity<OrderReturn> = {
      status: to,
      includeDeliveryCharge: includeDelivery,
      deliveryAmount,
      refundAmount,
      updatedBy: actor.id,
      updaterType: actor.type,
      updaterName: actor.name,
    };

    if (to === ReturnStatus.RETURNED) {
      const fresh = await manager.find(OrderItem, { where: itemIds.map((id) => ({ id })) });
      if (fresh.some((i) => i.isReturned)) throw new ConflictException('One of these items was already returned');
      await manager.update(OrderItem, itemIds, { isReturned: true, updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name });
      const unreturned = await manager.count(OrderItem, { where: { orderId: order.id, isReturned: false } });
      if (unreturned === 0) {
        await manager.update(Order, order.id, { isReturned: true, updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name });
      }
      const taken = await this.commission.takeBackForReturn(
        manager,
        order,
        ret.id,
        ret.scope === ReturnScope.FULL_ORDER,
        lines.map((l) => ({ orderItemId: l.orderItemId, refundAmount: l.refundAmount, commissionAmount: l.commissionAmount })),
        actor,
      );
      patch.commissionAmount = taken;
      patch.returnedAt = new Date();
    } else if (from === ReturnStatus.RETURNED) {
      await manager.update(OrderItem, itemIds, { isReturned: false, updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name });
      await manager.update(Order, order.id, { isReturned: false, updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name });
      await this.commission.undoReturn(manager, order, ret.id, options.note || `Return ${ret.returnNumber} moved to ${to}`, actor);
      patch.commissionAmount = tidy(lines.reduce((n, l) => n + l.commissionAmount, 0));
      patch.returnedAt = null;
    }

    await manager.update(OrderReturn, ret.id, patch);
    const history = await manager.save(OrderReturnStatusHistory, {
      createdBy: actor.id,
      creatorType: actor.type,
      creatorName: actor.name,
      orderReturnId: ret.id,
      fromStatus: from,
      status: to,
      note: options.note?.trim() || null,
    });
    if (options.files?.length) await this.saveAttachments(manager, ret.id, history.id, options.files, actor);
  }

  // --------------------------------------------------------------- helpers

  /** Checks the uploaded files, then stores them. Pair with `discardFiles` if the move fails. */
  async storeFiles(uploads: Express.Multer.File[] | undefined): Promise<StoredAttachment[]> {
    return this.files.store(this.files.validate(uploads), FOLDER);
  }

  /** Checks the files without storing them (for steps that may not need any). */
  checkFiles(uploads: Express.Multer.File[] | undefined) {
    return this.files.validate(uploads);
  }

  discardFiles(stored: StoredAttachment[]) {
    return this.files.discard(stored);
  }

  private lockOrder(manager: EntityManager, orderId: number) {
    return manager
      .createQueryBuilder(Order, 'o')
      .setLock('pessimistic_write')
      .where('o.id = :orderId', { orderId })
      .getOne();
  }

  private async saveAttachments(
    manager: EntityManager,
    returnId: number,
    historyId: number,
    stored: StoredAttachment[],
    actor: Actor,
  ) {
    if (stored.length === 0) return;
    await manager.save(
      OrderReturnAttachment,
      stored.map((s) => ({
        ...s,
        createdBy: actor.id,
        creatorType: actor.type,
        creatorName: actor.name,
        orderReturnId: returnId,
        statusHistoryId: historyId,
      })),
    );
  }

  private async newNumber(manager: EntityManager): Promise<string> {
    for (;;) {
      const now = new Date();
      const day = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
      const number = `RT${day}-${String(randomInt(100000)).padStart(5, '0')}`;
      if (!(await manager.exists(OrderReturn, { where: { returnNumber: number }, withDeleted: true }))) return number;
    }
  }
}
