import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Order } from '../../database/entities/order/order.entity';
import { OrderItem } from '../../database/entities/order/order-item.entity';
import { OrderReturn } from '../../database/entities/order-return/order-return.entity';
import { OrderUpdate } from '../../database/entities/order/order-update.entity';
import { PaymentAttachment } from '../../database/entities/payment/payment-attachment.entity';
import { PaymentStatusHistory } from '../../database/entities/payment/payment-status-history.entity';
import { Payment } from '../../database/entities/payment/payment.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { allowedTargets } from '../utils/order-status-rules';
import { tidy } from '../../shared/utils/money.util';

export interface SkuSnapshot {
  code?: string;
  label?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  slug?: string;
  bird?: Record<string, unknown>;
}

/** How orders look in API responses. Seller and admin screens reuse these. */
@Injectable()
export class OrderViewService {
  constructor(private readonly db: DatabaseService) {}

  async load(orderId: number) {
    return this.db.order.findOne({
      where: { id: orderId },
      relations: { seller: true, items: true, statusHistory: true },
      order: { items: { id: 'ASC' }, statusHistory: { id: 'ASC' } },
    });
  }

  async detailById(orderId: number, viewer: AuthUserType = AuthUserType.USER) {
    const order = await this.load(orderId);
    return order ? this.full(order, viewer) : null;
  }

  /** The order with everything around it: payments and their files, histories, updates. */
  async full(order: Order, viewer: AuthUserType) {
    const [payments, attachments, paymentHistory, updates, returns] = await Promise.all([
      this.db.payment.find({ where: { orderId: order.id }, order: { id: 'ASC' } }),
      this.db.paymentAttachment.find({ where: { orderId: order.id }, order: { id: 'ASC' } }),
      this.db.paymentStatusHistory.find({ where: { orderId: order.id }, order: { id: 'ASC' } }),
      this.db.orderUpdate.find({
        where: { orderId: order.id },
        relations: { attachments: true },
        order: { id: 'ASC', attachments: { id: 'ASC' } },
      }),
      this.db.orderReturn.find({ where: { orderId: order.id }, relations: { items: true }, order: { id: 'DESC' } }),
    ]);
    return this.detail(order, { payments, attachments, paymentHistory, updates, returns }, viewer);
  }

  attachment(a: {
    id: number;
    kind: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    size: number;
    creatorName: string | null;
    creatorType: AuthUserType | null;
    createdAt: Date;
  }) {
    return {
      id: a.id,
      kind: a.kind,
      fileName: a.fileName,
      url: a.fileUrl,
      mimeType: a.mimeType,
      size: a.size,
      uploadedBy: { name: a.creatorName, type: a.creatorType },
      createdAt: a.createdAt,
    };
  }

  /** Set when staff undid this payment. */
  reversal(p: Payment) {
    return p.reversedAt
      ? { at: p.reversedAt, by: { name: p.reversedByName, type: p.reversedByType }, reason: p.reversalReason }
      : null;
  }

  paymentHistory(h: PaymentStatusHistory) {
    return {
      id: h.id,
      paymentId: h.paymentId,
      fromStatus: h.fromStatus,
      status: h.status,
      amount: h.amount,
      amountPaidAfter: h.amountPaidAfter,
      note: h.note,
      by: { name: h.creatorName, type: h.creatorType },
      createdAt: h.createdAt,
    };
  }

  detail(
    order: Order,
    extras: {
      payments: Payment[];
      attachments: PaymentAttachment[];
      paymentHistory: PaymentStatusHistory[];
      updates: OrderUpdate[];
      returns?: OrderReturn[];
    },
    viewer: AuthUserType,
  ) {
    const { payments, attachments, paymentHistory, updates, returns = [] } = extras;
    return {
      ...this.summary(order, viewer),
      cartId: order.cartId,
      items: (order.items ?? []).map((i) => this.item(i, viewer)),
      // Returns on this order, newest first. A line is returned once one reaches `returned`.
      returns: returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        status: r.status,
        scope: r.scope,
        refundAmount: r.refundAmount,
        orderItemIds: (r.items ?? []).map((i) => i.orderItemId),
        createdAt: r.createdAt,
      })),
      totals: this.totals(order),
      // The platform's cut is for staff only; customers never see it.
      ...(viewer === AuthUserType.USER ? {} : { commission: this.commission(order) }),
      delivery: {
        type: order.deliveryType,
        estimatedDays: order.deliveryEstimatedDays,
        charge: order.deliveryCharge,
        zoneName: order.shippingZoneName,
      },
      address: {
        recipientName: order.recipientName,
        phone: order.recipientPhone,
        email: order.contactEmail,
        line: order.deliveryAddress,
        city: order.city,
        state: order.state,
        postalCode: order.zipCode,
        countryCode: order.countryCode,
        countryName: order.countryName,
      },
      payments: payments.map((p) => ({
        id: p.id,
        gateway: { id: p.paymentGatewayId, name: p.paymentGatewayName, slug: p.paymentGatewaySlug },
        status: p.status,
        amount: p.amount,
        transactionId: p.transactionId,
        description: p.description,
        proof: (p.metaData?.proof as Record<string, string> | undefined) ?? null,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        attachments: attachments.filter((a) => a.paymentId === p.id).map((a) => this.attachment(a)),
        reversal: this.reversal(p),
        // Who recorded the money (not set while waiting, or after a reversal, which has its own record).
        recordedBy: p.status === 'due' || p.reversedAt ? null : { name: p.updaterName ?? p.creatorName, type: p.updaterType ?? p.creatorType },
      })),
      paymentHistory: paymentHistory.map((h) => this.paymentHistory(h)),
      updates: updates.map((u) => ({
        id: u.id,
        message: u.message,
        attachments: (u.attachments ?? []).map((a) => this.attachment(a)),
        by: { name: u.creatorName, type: u.creatorType },
        createdAt: u.createdAt,
      })),
      note: order.note,
      statusHistory: (order.statusHistory ?? []).map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        status: h.status,
        note: h.note,
        by: { name: h.creatorName, type: h.creatorType },
        createdAt: h.createdAt,
      })),
    };
  }

  /** The row shown in a list. */
  summary(order: Order, viewer: AuthUserType = AuthUserType.USER) {
    const items = order.items ?? [];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      seller: order.seller
        ? { id: order.seller.id, name: order.seller.name, avatarUrl: order.seller.avatarUrl ?? null }
        : { id: order.sellerId, name: 'Seller', avatarUrl: null },
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      previewItems: items.slice(0, 3).map((i) => ({
        productName: i.productName,
        imageUrl: this.image(i),
      })),
      payable: order.payableAmount,
      amountPaid: order.amountPaid,
      gateway: { id: order.paymentGatewayId, name: order.paymentGatewayName, slug: order.paymentGatewaySlug },
      createdAt: order.createdAt,
      isReturned: order.isReturned,
      canCancel: allowedTargets(viewer, order.status).includes(OrderStatus.CANCELLED),
      // What this viewer may move the order to right now.
      allowedStatuses: allowedTargets(viewer, order.status),
      customer: {
        userId: order.userId,
        isGuest: order.userId === null,
        name: order.recipientName,
        phone: order.recipientPhone,
        email: order.contactEmail,
      },
      deliveryType: order.deliveryType,
      countryCode: order.countryCode,
      countryName: order.countryName,
    };
  }

  private commission(order: Order) {
    return {
      type: order.commissionType,
      value: order.commissionValue,
      systemCommission: order.systemCommission,
      sellerAmount: order.sellerAmount,
    };
  }

  private totals(order: Order) {
    return {
      listTotal: order.total,
      subtotal: order.subtotal,
      savings: tidy(order.total - order.subtotal),
      deliveryCharge: order.deliveryCharge,
      discountAmount: order.discountAmount,
      payable: order.payableAmount,
      amountPaid: order.amountPaid,
      balanceDue: tidy(order.payableAmount - order.amountPaid),
    };
  }

  private image(item: OrderItem): string | null {
    const sku = item.skuData as SkuSnapshot;
    return sku?.imageUrl ?? sku?.thumbnailUrl ?? null;
  }

  private item(item: OrderItem, viewer: AuthUserType) {
    const sku = (item.skuData ?? {}) as SkuSnapshot;
    return {
      id: item.id,
      productId: item.sellerProductId,
      productName: item.productName,
      productSlug: sku.slug ?? null,
      sku: { id: item.sellerProductSkuId, code: sku.code ?? null, label: sku.label ?? '' },
      // Pigeon facts as they were when the order was placed; null for other items and older orders.
      bird: sku.bird ?? null,
      imageUrl: this.image(item),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      // What the SKU cost when the order was placed.
      skuUnitPrice: item.unitDiscountedPrice ?? item.unitPrice,
      // The accepted proposal this line was bought at, if any.
      proposal:
        item.proposalId && item.unitProposalPrice != null
          ? { id: item.proposalId, unitPrice: item.unitProposalPrice, lineTotal: item.totalProposalPrice }
          : null,
      // What was charged.
      unitPayable: item.unitProposalPrice ?? item.unitDiscountedPrice ?? item.unitPrice,
      lineTotal: item.totalProposalPrice ?? item.totalDiscountedPrice ?? item.totalPrice,
      isReturned: item.isReturned,
      // The platform's cut of this line is for staff only.
      ...(viewer === AuthUserType.USER ? {} : { systemCommission: item.systemCommission, sellerAmount: item.sellerAmount }),
    };
  }
}
