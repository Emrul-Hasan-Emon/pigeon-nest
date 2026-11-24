import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Order } from '../../database/entities/order/order.entity';
import { OrderRefund } from '../../database/entities/order/order-refund.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { RefundKind, RefundStatus } from '../../database/enums/refund-status.enum';
import { likeContains } from '../../shared/utils/like.util';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { AddRefundRecordDto, ChangeRefundStatusDto, ListRefundsQueryDto } from '../dtos/order-staff.dtos';
import { refundRecordView } from '../utils/refund-view.util';
import { OrderFileService, StoredAttachment } from './order-file.service';
import { OrderRefundService } from './order-refund.service';
import { StatusActor } from './order-status.service';

const FOLDER = 'order-refunds';

/** `sellerId` limits it to one seller's orders (a seller); leave it out for an admin. */
export interface RefundScope {
  sellerId?: number;
}

/**
 * Why `actor` may not move a refund from `from` to `to`, or null when they may.
 * A seller goes needs_to_refund -> processing -> refunded, one step at a time. An admin may set any status.
 */
export function refundTransitionDenied(actor: AuthUserType, from: RefundStatus, to: RefundStatus): string | null {
  if (from === to) return `The refund is already ${to.replace(/_/g, ' ')}`;
  if (actor === AuthUserType.ADMIN) return null;
  if (from === RefundStatus.NEEDS_TO_REFUND && to === RefundStatus.PROCESSING) return null;
  if (from === RefundStatus.PROCESSING && to === RefundStatus.REFUNDED) return null;
  if (from === RefundStatus.NEEDS_TO_REFUND && to === RefundStatus.REFUNDED) return 'Mark the refund as processing first, then as refunded';
  return 'Only an admin can change a refund that way';
}

/** The refund screens of the seller (their own orders) and the admin (all): list, move on, and the admin's extra records. */
@Injectable()
export class StaffOrderRefundService {
  constructor(
    private readonly db: DatabaseService,
    private readonly refunds: OrderRefundService,
    private readonly files: OrderFileService,
  ) {}

  /** Cancelled-order refunds, newest first. */
  async list(query: ListRefundsQueryDto, page: PageRequest, scope: RefundScope) {
    const qb = this.db.orderRefund
      .createQueryBuilder('r')
      .innerJoinAndMapOne('r.order', Order, 'o', 'o.id = r."orderId"')
      .leftJoin('o.seller', 's')
      .addSelect(['s.id', 's.name'])
      .where('r."deletedAt" IS NULL AND r.kind = :kind', { kind: RefundKind.CANCELLED_ORDER })
      .orderBy('r.id', 'DESC');
    if (scope.sellerId !== undefined) qb.andWhere('r."sellerId" = :sid', { sid: scope.sellerId });
    if (query.status) qb.andWhere('r.status = :st', { st: query.status });
    if (query.search) qb.andWhere('(o."orderNumber" ILIKE :q OR o."recipientName" ILIKE :q OR o."recipientPhone" ILIKE :q)', { q: likeContains(query.search) });
    const [rows, total] = await qb.skip(page.offset).take(page.pageSize).getManyAndCount();
    const counts: { orderId: number; n: string }[] = rows.length
      ? await this.db.orderRefund.query(`select "orderId", count(*) n from order_refund where "orderId" = any($1::int[]) and "deletedAt" is null group by "orderId"`, [rows.map((r) => r.orderId)])
      : [];
    const byOrder = new Map(counts.map((c) => [c.orderId, Number(c.n)]));
    return pageResult(
      rows.map((r) => {
        const o = (r as unknown as { order: Order & { seller?: { id: number; name: string } } }).order;
        return {
          id: r.id,
          status: r.status,
          expectedAmount: r.expectedAmount,
          amount: r.amount,
          note: r.note,
          refundedAt: r.refundedAt,
          createdAt: r.createdAt,
          recordsOnOrder: byOrder.get(r.orderId) ?? 1,
          order: { id: o.id, orderNumber: o.orderNumber, status: o.status, amountPaid: o.amountPaid, customerName: o.recipientName, customerPhone: o.recipientPhone, sellerName: o.seller?.name ?? null },
        };
      }),
      total,
      page,
    );
  }

  /** How many refunds wait for the seller or admin. */
  async summary(scope: RefundScope) {
    const rows: { status: string; n: string }[] = await this.db.orderRefund.query(
      `select r.status, count(*) n from order_refund r where r."deletedAt" is null and r.kind = 'cancelled_order' and ($1::int is null or r."sellerId" = $1) group by r.status`,
      [scope.sellerId ?? null],
    );
    const n = (s: RefundStatus) => Number(rows.find((r) => r.status === s)?.n ?? 0);
    return { needsToRefund: n(RefundStatus.NEEDS_TO_REFUND), processing: n(RefundStatus.PROCESSING), refunded: n(RefundStatus.REFUNDED) };
  }

  /** One refund with its order and history. */
  async detail(id: number, scope: RefundScope) {
    const r = await this.db.orderRefund.findOne({ where: { id, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) }, relations: { history: true } });
    if (!r) throw new NotFoundException('Refund not found');
    return refundRecordView(r);
  }

  /** The proof and the amount a refunded step needs. The seller must attach a file; an admin may. */
  private async checkRefunded(order: Order, dto: { amount?: number; note?: string }, uploads: Express.Multer.File[] | undefined, actor: StatusActor, expected?: number) {
    this.refunds.assertAmountMatches(order, dto.amount, expected);
    if (!dto.note || dto.note.trim().length < 3) throw new BadRequestException('Write a note: how and when the money was sent');
    const list = this.files.validate(uploads);
    if (list.length === 0 && actor.type === AuthUserType.SELLER) throw new BadRequestException('Attach a screenshot or a file that proves you sent the money back');
    return list;
  }

  /** Move a refund to a new status. Everything is recorded in the history. */
  async change(id: number, dto: ChangeRefundStatusDto, uploads: Express.Multer.File[] | undefined, actor: StatusActor, scope: RefundScope) {
    const probe = await this.db.orderRefund.findOne({ where: { id, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) } });
    if (!probe) throw new NotFoundException('Refund not found');
    const denied = refundTransitionDenied(actor.type, probe.status, dto.status);
    if (denied) throw new ForbiddenException(denied);
    const order = await this.db.order.findOne({ where: { id: probe.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (probe.kind === RefundKind.CANCELLED_ORDER && order.status !== OrderStatus.CANCELLED && dto.status !== RefundStatus.VOIDED) {
      throw new ConflictException('This order is not cancelled any more');
    }

    const list = dto.status === RefundStatus.REFUNDED ? await this.checkRefunded(order, dto, uploads, actor, probe.kind === RefundKind.RETURN ? probe.expectedAmount : undefined) : this.files.validate(uploads);
    const stored: StoredAttachment[] = list.length ? await this.files.store(list, FOLDER) : [];
    try {
      await this.db.orderRefund.manager.transaction(async (manager) => {
        const r = await manager.findOneOrFail(OrderRefund, { where: { id }, lock: { mode: 'pessimistic_write' } });
        const again = refundTransitionDenied(actor.type, r.status, dto.status);
        if (again) throw new ConflictException(again);
        const from = r.status;
        const patch: Record<string, unknown> = { status: dto.status, updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name };
        if (dto.status === RefundStatus.REFUNDED) {
          patch.amount = dto.amount ?? null;
          patch.note = dto.note?.trim() ?? null;
          patch.transactionId = dto.transactionId ?? null;
          patch.proof = [...(r.proof ?? []), ...stored];
          patch.refundedAt = new Date();
          patch.refundedByName = actor.name;
        } else if (from === RefundStatus.REFUNDED) {
          // An admin takes a refund back out of "refunded": the money is not counted as sent any more.
          patch.refundedAt = null;
          patch.refundedByName = null;
          patch.amount = null;
        }
        if (dto.status !== RefundStatus.REFUNDED && dto.note) patch.note = dto.note.trim();
        await manager.update(OrderRefund, id, patch as never);
        await this.refunds.log(manager, r, from, dto.status, dto.note?.trim() ?? null, dto.status === RefundStatus.REFUNDED ? (dto.amount ?? null) : null, stored, actor);
        await this.refunds.syncOrder(manager, r.orderId);
      });
    } catch (e) {
      await this.files.discard(stored);
      throw e;
    }
    return this.detail(id, scope);
  }

  /**
   * An admin adds a money record on a return: the seller said the refund was sent, the buyer says it never came, so
   * the admin records what really happened. The amount must match what the return refunds. It does not change the
   * return's own status.
   */
  async addForReturn(returnId: number, dto: AddRefundRecordDto, uploads: Express.Multer.File[] | undefined, actor: StatusActor) {
    const ret = await this.db.orderReturn.findOne({ where: { id: returnId } });
    if (!ret) throw new NotFoundException('Return not found');
    if (['return_requested', 'rejected', 'cancelled'].includes(ret.status)) throw new ConflictException('Money can only be recorded on a return the seller has accepted');
    const order = await this.db.order.findOne({ where: { id: ret.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const status = dto.status ?? RefundStatus.REFUNDED;
    if (status === RefundStatus.VOIDED) throw new BadRequestException('Choose needs to refund, processing or refunded');
    const list = status === RefundStatus.REFUNDED ? await this.checkRefunded(order, dto, uploads, actor, ret.refundAmount) : this.files.validate(uploads);
    const stored = list.length ? await this.files.store(list, FOLDER) : [];
    try {
      const id = await this.db.orderRefund.manager.transaction(async (manager) => {
        const refunded = status === RefundStatus.REFUNDED;
        const r = await manager.save(OrderRefund, {
          orderId: ret.orderId,
          sellerId: ret.sellerId,
          userId: ret.userId,
          kind: RefundKind.RETURN,
          orderReturnId: ret.id,
          status,
          expectedAmount: ret.refundAmount,
          amount: refunded ? (dto.amount ?? null) : null,
          note: dto.note?.trim() ?? null,
          transactionId: dto.transactionId ?? null,
          proof: stored,
          refundedAt: refunded ? new Date() : null,
          refundedByName: refunded ? actor.name : null,
          createdBy: actor.id,
          creatorType: actor.type,
          creatorName: actor.name,
        });
        await this.refunds.log(manager, r, null, status, dto.note?.trim() ?? 'Added by an admin', refunded ? (dto.amount ?? null) : null, stored, actor);
        return r.id;
      });
      return this.detail(id, {});
    } catch (e) {
      await this.files.discard(stored);
      throw e;
    }
  }

  /**
   * An admin adds another refund record on a cancelled order, for example when a seller said "refunded" and the buyer
   * says the money never came. It is usually "refunded" with the amount and proof; any status may be used.
   */
  async addForOrder(orderId: number, dto: AddRefundRecordDto, uploads: Express.Multer.File[] | undefined, actor: StatusActor) {
    const order = await this.db.order.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.CANCELLED) throw new ConflictException('Refunds are only for cancelled orders');
    if (order.amountPaid <= 0) throw new ConflictException('No money was paid on this order, so there is nothing to refund');
    const status = dto.status ?? RefundStatus.REFUNDED;
    if (status === RefundStatus.VOIDED) throw new BadRequestException('Choose needs to refund, processing or refunded');
    const list = status === RefundStatus.REFUNDED ? await this.checkRefunded(order, dto, uploads, actor) : this.files.validate(uploads);
    const stored = list.length ? await this.files.store(list, FOLDER) : [];
    try {
      const id = await this.db.orderRefund.manager.transaction(async (manager) => {
        const refunded = status === RefundStatus.REFUNDED;
        const r = await manager.save(OrderRefund, {
          orderId,
          sellerId: order.sellerId,
          userId: order.userId,
          kind: RefundKind.CANCELLED_ORDER,
          status,
          expectedAmount: order.amountPaid,
          amount: refunded ? (dto.amount ?? null) : null,
          note: dto.note?.trim() ?? null,
          transactionId: dto.transactionId ?? null,
          proof: stored,
          refundedAt: refunded ? new Date() : null,
          refundedByName: refunded ? actor.name : null,
          createdBy: actor.id,
          creatorType: actor.type,
          creatorName: actor.name,
        });
        await this.refunds.log(manager, r, null, status, dto.note?.trim() ?? 'Added by an admin', refunded ? (dto.amount ?? null) : null, stored, actor);
        await this.refunds.syncOrder(manager, orderId);
        return r.id;
      });
      return this.detail(id, {});
    } catch (e) {
      await this.files.discard(stored);
      throw e;
    }
  }
}
