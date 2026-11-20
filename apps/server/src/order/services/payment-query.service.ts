import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { ListPaymentQueryDto } from '../dtos/order-staff.dtos';
import { OrderViewService } from './order-view.service';
import { tidy } from '../../shared/utils/money.util';

// A date-only upper bound means "through the end of that day".
function upperBound(value: string): Date {
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date;
}

/** Payment lists and details for the admin (all sellers) and a seller (own orders only). */
@Injectable()
export class PaymentQueryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly views: OrderViewService,
  ) {}

  async list(query: ListPaymentQueryDto, pagination: CursorPagination, sellerScope?: number) {
    if (query.minAmount !== undefined && query.maxAmount !== undefined && query.minAmount > query.maxAmount) {
      throw new BadRequestException('minAmount cannot be greater than maxAmount');
    }
    for (const [from, to] of [
      [query.createdFrom, query.createdTo],
      [query.paidFrom, query.paidTo],
    ] as const) {
      if (from && to && new Date(from) > upperBound(to)) {
        throw new BadRequestException('A "from" date cannot be after its "to" date');
      }
    }

    const qb = this.db.payment
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.order', 'o')
      .innerJoinAndSelect('o.seller', 's')
      .orderBy('p.id', 'DESC')
      .take(pagination.limit);
    if (pagination.cursor > 0) qb.andWhere('p.id < :cursor', { cursor: pagination.cursor });

    if (sellerScope !== undefined) qb.andWhere('o.sellerId = :scope', { scope: sellerScope });
    else if (query.sellerId !== undefined) qb.andWhere('o.sellerId = :sid', { sid: query.sellerId });
    if (query.status) qb.andWhere('p.status = :status', { status: query.status });
    // A reversed receipt goes back to "due" but is not a payment still waiting to come in.
    if (query.status === 'due' && query.reversed === undefined) qb.andWhere('p.reversedAt IS NULL');
    if (query.reversed !== undefined) qb.andWhere(`p.reversedAt IS ${query.reversed ? 'NOT ' : ''}NULL`);
    if (query.orderId !== undefined) qb.andWhere('p.orderId = :orderId', { orderId: query.orderId });
    if (query.orderNumber) qb.andWhere('o.orderNumber ILIKE :on', { on: likeContains(query.orderNumber) });
    if (query.gatewayId !== undefined) qb.andWhere('p.paymentGatewayId = :gw', { gw: query.gatewayId });
    if (query.transactionId) qb.andWhere('p.transactionId ILIKE :tx', { tx: likeContains(query.transactionId) });
    if (query.customerSearch) {
      qb.andWhere(
        '(o.recipientName ILIKE :cs OR o.recipientPhone ILIKE :cs OR o.contactEmail ILIKE :cs)',
        { cs: likeContains(query.customerSearch) },
      );
    }
    if (query.minAmount !== undefined) qb.andWhere('p.amount >= :minA', { minA: query.minAmount });
    if (query.maxAmount !== undefined) qb.andWhere('p.amount <= :maxA', { maxA: query.maxAmount });
    if (query.hasAttachments !== undefined) {
      qb.andWhere(
        `${query.hasAttachments ? '' : 'NOT '}EXISTS (SELECT 1 FROM "payment_attachments" a WHERE a."paymentId" = p.id AND a."deletedAt" IS NULL)`,
      );
    }
    if (query.createdFrom) qb.andWhere('p.createdAt >= :cf', { cf: new Date(query.createdFrom) });
    if (query.createdTo) qb.andWhere('p.createdAt <= :ct', { ct: upperBound(query.createdTo) });
    if (query.paidFrom) qb.andWhere('p.paidAt >= :pf', { pf: new Date(query.paidFrom) });
    if (query.paidTo) qb.andWhere('p.paidAt <= :pt', { pt: upperBound(query.paidTo) });

    const page = getCursorPaginateData(await qb.getMany(), pagination.limit);
    const counts = await this.attachmentCounts(page.results.map((p) => p.id));
    return {
      results: page.results.map((p) => this.row(p, counts.get(p.id) ?? 0)),
      nextCursor: page.nextCursor,
    };
  }

  async details(id: number, sellerScope?: number) {
    const payment = await this.db.payment.findOne({
      where: { id, ...(sellerScope !== undefined ? { order: { sellerId: sellerScope } } : {}) },
      relations: { order: { seller: true } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const attachments = await this.db.paymentAttachment.find({
      where: { paymentId: id },
      order: { id: 'ASC' },
    });
    const history = await this.db.paymentStatusHistory.find({
      where: { orderId: payment.orderId },
      order: { id: 'ASC' },
    });
    const o = payment.order;
    return {
      ...this.row(payment, attachments.length),
      proof: (payment.metaData?.proof as Record<string, string> | undefined) ?? null,
      attachments: attachments.map((a) => this.views.attachment(a)),
      order: {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        payable: o.payableAmount,
        amountPaid: o.amountPaid,
        balanceDue: tidy(o.payableAmount - o.amountPaid),
      },
      history: history.map((h) => this.views.paymentHistory(h)),
    };
  }

  private async attachmentCounts(ids: number[]) {
    const map = new Map<number, number>();
    if (ids.length === 0) return map;
    const rows = await this.db.paymentAttachment
      .createQueryBuilder('a')
      .select('a.paymentId', 'paymentId')
      .addSelect('COUNT(*)', 'count')
      .where('a.paymentId IN (:...ids)', { ids })
      .groupBy('a.paymentId')
      .getRawMany<{ paymentId: number; count: string }>();
    for (const r of rows) map.set(Number(r.paymentId), Number(r.count));
    return map;
  }

  private row(p: import('../../database/entities/payment/payment.entity').Payment, attachmentCount: number) {
    const o = p.order;
    return {
      id: p.id,
      orderId: p.orderId,
      orderNumber: o?.orderNumber ?? null,
      orderStatus: o?.status ?? null,
      orderPaymentStatus: o?.paymentStatus ?? null,
      seller: o?.seller ? { id: o.seller.id, name: o.seller.name } : null,
      customer: o ? { name: o.recipientName, phone: o.recipientPhone, email: o.contactEmail, isGuest: o.userId === null } : null,
      gateway: { id: p.paymentGatewayId, name: p.paymentGatewayName, slug: p.paymentGatewaySlug },
      status: p.status,
      amount: p.amount,
      transactionId: p.transactionId,
      description: p.description,
      paidAt: p.paidAt,
      attachmentCount,
      reversal: this.views.reversal(p),
      recordedBy: p.status === 'due' || p.reversedAt ? null : { name: p.updaterName ?? p.creatorName, type: p.updaterType ?? p.creatorType },
      createdAt: p.createdAt,
    };
  }
}
