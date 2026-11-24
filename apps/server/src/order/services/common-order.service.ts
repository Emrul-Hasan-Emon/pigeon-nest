import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { allowedTargets, transitionDenied } from '../utils/order-status-rules';
import { moneyGreater, sameMoney, tidy } from '../../shared/utils/money.util';
import { PaymentClaim } from '../../database/entities/payment/payment-claim.entity';
import { SellerPaymentAccount } from '../../database/entities/payment/seller-payment-account.entity';
import { OrderRefund } from '../../database/entities/order/order-refund.entity';
import { refundRecordView } from '../utils/refund-view.util';
import { EntityManager, In, IsNull } from 'typeorm';
import { OrderStatusHistory } from '../../database/entities/order/order-status-history.entity';
import { PaymentGateway } from '../../database/entities/payment/payment-gateway.entity';
import { SellerProductSku } from '../../database/entities/product/seller-product-sku.entity';
import { DeliveryType } from '../../database/enums/delivery-type.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { GATEWAY_TYPE_LABELS, proofFieldsFor } from '../../payment/utils/payment-gateway.util';
import { ShippingQuote, ShippingZoneService } from '../../settings/services/shipping-zone.service';
import { countryName, listCountries } from '../../settings/utils/countries';
import { CommonCommissionService } from '../../commission/services/common-commission.service';
import { newOrderNumber } from '../utils/order-number.util';
import { StockReason } from '../../database/enums/stock-movement.enum';
import { recordStockMovements } from '../../shared/utils/stock-movement.util';
import { assertNoLiveReturns } from '../../returns/utils/return-guard.util';
import {
  AddRefundRecordDto,
  BulkChangeOrderStatusDto,
  ChangeOrderStatusDto,
  ChangeRefundStatusDto,
  CreateStaffOrderDto,
  ListPaymentQueryDto,
  ListRefundsQueryDto,
  ListStaffOrderQueryDto,
  OrderOwnerKind,
  PostOrderUpdateDto,
  RecordPaymentDto,
  ReversePaymentDto,
  StaffCatalogQueryDto,
} from '../dtos/order-staff.dtos';
import { AttachmentFileService, StoredAttachment } from '../../shared/services/attachment-file.service';
import { OrderUpdateAttachment } from '../../database/entities/order/order-update-attachment.entity';
import { OrderRefundStatusHistory } from '../../database/entities/order/order-refund-status-history.entity';
import { RefundKind, RefundStatus } from '../../database/enums/refund-status.enum';
import { getUserAccess } from '../../auth/policies/user-access.policy';
import { SellerProduct } from '../../database/entities/product/seller-product.entity';
import { ProductActiveStatus } from '../../database/enums/product-active-status.enum';
import { ProductStatus } from '../../database/enums/product-status.enum';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { effectivePrice } from '../../storefront/storefront-product.service';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';

export interface SkuSnapshot {
  code?: string;
  label?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  slug?: string;
  bird?: Record<string, unknown>;
}

export const round2 = tidy;
const PROOF_VALUE_MAX = 200;

/** A line priced from the live SKU, ready to become an order item. */
export interface PlacementLine {
  productId: number;
  productName: string;
  productSlug: string;
  thumbnailUrl: string | null;
  skuId: number;
  skuCode: string;
  skuLabel: string;
  skuImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  /** What the customer pays per unit: the proposal price when one applies. */
  unitPayable: number;
  /** An accepted price proposal this line is bought at (customers only). skuUnitPayable is the SKU's own price now. */
  proposal?: { id: number; unitPrice: number; skuUnitPayable: number } | null;
}

export interface Placement {
  /** Whose order it is. Both empty for a walk-in customer a staff member entered. */
  userId: number | null;
  guestSessionId: string | null;
  sellerId: number;
  cartId: number | null;
  lines: PlacementLine[];
  gateway: PaymentGateway;
  proof: Record<string, string> | null;
  quote: ShippingQuote;
  deliveryType: DeliveryType;
  recipientName: string;
  recipientPhone: string;
  contactEmail: string | null;
  countryCode: string;
  state: string | null;
  city: string;
  addressLine: string;
  postalCode: string | null;
  note: string | null;
  /** Who is placing it: the customer, or the seller or admin who entered it. */
  placedBy: { id: number | null; type: AuthUserType; name: string };
  historyNote: string;
}

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

const FOLDER_PAYMENTS = 'order-payments';

const FOLDER_UPDATES = 'order-updates';

// A date-only upper bound means "through the end of that day".
function upperBound(value: string): Date {
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date;
}

const FOLDER_REFUNDS = 'order-refunds';

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

/**
 * Everything about orders that more than one role needs. It places an order, shows it, changes its status, records and
 * reverses payments, posts updates, keeps refund records, and runs the staff lists (orders, payments and refunds) with an
 * optional seller limit. The admin, seller and customer services call it; other modules call it for payments.
 */
@Injectable()
export class CommonOrderService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shipping: ShippingZoneService,
    private readonly commission: CommonCommissionService,
    private readonly files: AttachmentFileService,
  ) {}

  // ---- the order as every role sees it (the view) ----


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
    const [payments, attachments, paymentHistory, updates, returns, accounts, claims, refunds] = await Promise.all([
      this.db.payment.find({ where: { orderId: order.id }, order: { id: 'ASC' } }),
      this.db.paymentAttachment.find({ where: { orderId: order.id }, order: { id: 'ASC' } }),
      this.db.paymentStatusHistory.find({ where: { orderId: order.id }, order: { id: 'ASC' } }),
      this.db.orderUpdate.find({
        where: { orderId: order.id },
        relations: { attachments: true },
        order: { id: 'ASC', attachments: { id: 'ASC' } },
      }),
      this.db.orderReturn.find({ where: { orderId: order.id }, relations: { items: true }, order: { id: 'DESC' } }),
      // Where to pay: a customer sees only the accounts that are switched on; staff see them all.
      this.db.sellerPaymentAccount.find({
        where: { sellerId: order.sellerId, ...(viewer === AuthUserType.USER ? { isActive: true } : {}) },
        order: { id: 'ASC' },
      }),
      this.db.paymentClaim.find({ where: { orderId: order.id }, order: { id: 'DESC' } }),
      // Money back for a cancelled order (or an extra record on a return): everyone sees the same records.
      this.db.orderRefund.find({ where: { orderId: order.id }, relations: { history: true }, order: { id: 'DESC' } }),
    ]);
    return this.viewDetail(order, { payments, attachments, paymentHistory, updates, returns, accounts, claims, refunds }, viewer);
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

  viewDetail(
    order: Order,
    extras: {
      payments: Payment[];
      attachments: PaymentAttachment[];
      paymentHistory: PaymentStatusHistory[];
      updates: OrderUpdate[];
      returns?: OrderReturn[];
      accounts?: SellerPaymentAccount[];
      claims?: PaymentClaim[];
      refunds?: OrderRefund[];
    },
    viewer: AuthUserType,
  ) {
    const { payments, attachments, paymentHistory, updates, returns = [], accounts = [], claims = [], refunds = [] } = extras;
    return {
      ...this.viewSummary(order, viewer),
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
      refunds: refunds.map((r) => refundRecordView(r)),
      // Where the customer sends money, and the "I have paid" messages about this order.
      payTo: accounts.map((a) => ({ id: a.id, kind: a.kind, provider: a.provider, accountName: a.accountName, accountNumber: a.accountNumber, branchName: a.branchName, note: a.note, isActive: a.isActive })),
      paymentClaims: claims.map((c) => ({
        id: c.id,
        amount: c.amount,
        transactionId: c.transactionId,
        method: c.method,
        senderNumber: c.senderNumber,
        paidOn: c.paidOn,
        note: c.note,
        status: c.status,
        decisionNote: c.decisionNote,
        decidedAt: c.decidedAt,
        decidedByName: c.decidedByName,
        createdAt: c.createdAt,
        attachments: (c.attachments ?? []).map((a) => ({ kind: a.kind, fileName: a.fileName, fileUrl: a.fileUrl })),
      })),
      // The platform's cut is for staff only; customers never see it.
      ...(viewer === AuthUserType.USER ? {} : { commission: this.commissionOf(order) }),
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
  viewSummary(order: Order, viewer: AuthUserType = AuthUserType.USER) {
    const items = order.items ?? [];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      // Money back for a cancelled order: needs_to_refund, processing, refunded, or empty.
      refundStatus: order.refundStatus ?? null,
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

  private commissionOf(order: Order) {
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

  // ---- placing an order: gateways, delivery options, proof checks and the insert ----


  async activeGateway(id: number): Promise<PaymentGateway> {
    const gateway = await this.db.paymentGateway.findOne({ where: { id, isActive: true } });
    if (!gateway) throw new BadRequestException('Choose an available payment method');
    return gateway;
  }

  async gatewayOptions() {
    const gateways = await this.db.paymentGateway.find({ where: { isActive: true }, order: { id: 'ASC' } });
    return gateways.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      type: g.type,
      typeLabel: GATEWAY_TYPE_LABELS[g.type],
      description: g.description,
      iconUrl: g.iconUrl ?? null,
      accountName: g.accountName ?? null,
      accountNumber: g.accountNumber ?? null,
      bankName: g.bankName ?? null,
      branchName: g.branchName ?? null,
      proofFields: proofFieldsFor(g.type),
    }));
  }

  /** A price and delivery time for each delivery type to one country. */
  async deliveryOptions(countryCode: string, subtotal: number) {
    return Promise.all(
      Object.values(DeliveryType).map(async (deliveryType) => {
        const q = await this.shipping.quote(countryCode, deliveryType);
        return {
          deliveryType,
          charge: q.charge,
          estimatedDays: q.estimatedDays,
          supportsLiveAnimal: q.supportsLiveAnimal,
          zoneName: q.zone?.name ?? null,
          payable: round2(subtotal + q.charge),
        };
      }),
    );
  }

  /**
   * The proof a gateway asks for, as short text. Unknown fields are always refused;
   * missing required ones only when `enforce` (customers must give them, staff may add them later).
   */
  checkProof(gateway: PaymentGateway, given: Record<string, unknown> | undefined, enforce: boolean) {
    const fields = proofFieldsFor(gateway.type);
    const input = given ?? {};
    const known = new Set(fields.map((f) => f.key));
    const unknown = Object.keys(input).filter((k) => !known.has(k));
    if (unknown.length > 0) {
      throw new BadRequestException(`${gateway.name} does not take: ${unknown.join(', ')}`);
    }
    const proof: Record<string, string> = {};
    for (const field of fields) {
      const raw = input[field.key];
      if (raw !== undefined && typeof raw !== 'string') {
        throw new BadRequestException(`${field.label} must be text`);
      }
      const value = raw?.trim() ?? '';
      if (value.length > PROOF_VALUE_MAX) {
        throw new BadRequestException(`${field.label} must be at most ${PROOF_VALUE_MAX} characters`);
      }
      if (!value && field.required && enforce) {
        throw new BadRequestException(`${field.label} is required for ${gateway.name}`);
      }
      if (value) proof[field.key] = value;
    }
    return Object.keys(proof).length > 0 ? proof : null;
  }

  /**
   * Marks each proposal the order was placed with as used. The update only
   * matches a proposal still accepted and the buyer's own, so one an admin
   * closed a moment ago fails the order cleanly instead of selling at its price.
   */
  private async useProposals(manager: EntityManager, p: Placement, orderId: number) {
    for (const line of p.lines) {
      if (!line.proposal) continue;
      const [gone]: [{ id: number }[], number] = await manager.query(
        `UPDATE sku_price_proposal
            SET status = 'used', "usedAt" = now(), "orderId" = $2, "updatedAt" = now(),
                "updatedBy" = $4, "updaterType" = $5, "updaterName" = $6
          WHERE id = $1 AND status = 'accepted' AND "userId" = $3 AND "deletedAt" IS NULL
          RETURNING id`,
        [line.proposal.id, orderId, p.userId, p.placedBy.id, p.placedBy.type, p.placedBy.name],
      );
      if (gone.length === 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'A price proposal in this cart changed while the order was being placed. Check the cart and try again.',
          issues: [`The price proposal for ${line.productName} is no longer available.`],
        });
      }
      await manager.query(
        `INSERT INTO sku_price_proposal_history
           ("proposalId", action, "actorType", "actorId", "actorName", price, quantity, "skuPriceAtTime", note,
            "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
         VALUES ($1, 'used', $2, $3, $4, $5, $6, $7, $8, $3, $2, $4, $3, $2, $4)`,
        [
          line.proposal.id,
          p.placedBy.type,
          p.placedBy.id,
          p.placedBy.name,
          line.proposal.unitPrice,
          line.quantity,
          line.proposal.skuUnitPayable,
          'Order placed',
        ],
      );
    }
  }

  /** Takes the stock, then writes the order with its lines, payment and first history rows. */
  async insert(manager: EntityManager, p: Placement): Promise<number> {
    // The condition makes a lost race for the last unit a clean failure.
    const byPriority = [...p.lines].sort((a, b) => a.skuId - b.skuId);
    for (const line of byPriority) {
      const result = await manager
        .createQueryBuilder()
        .update(SellerProductSku)
        .set({ quantity: () => `"quantity" - ${line.quantity}` })
        .where('id = :skuId AND "isActive" = true AND quantity >= :q', { skuId: line.skuId, q: line.quantity })
        .execute();
      if (!result.affected) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'Stock changed while the order was being placed. Check the items and try again.',
          issues: [`${line.productName} is no longer available in this quantity.`],
        });
      }
    }

    const total = round2(p.lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0));
    const subtotal = round2(p.lines.reduce((n, l) => n + l.unitPayable * l.quantity, 0));
    const payable = round2(subtotal + p.quote.charge);
    // Same rule for every way an order is placed: customer, guest, seller or admin.
    // Each line has its own commission; the order's is their sum.
    const earned = await this.commission.forNewOrder(
      manager,
      p.sellerId,
      p.lines.map((l) => round2(l.unitPayable * l.quantity)),
      payable,
    );
    const stamp = {
      createdBy: p.placedBy.id,
      creatorType: p.placedBy.type,
      creatorName: p.placedBy.name,
    };

    let orderNumber = newOrderNumber();
    while (await manager.exists(Order, { where: { orderNumber }, withDeleted: true })) {
      orderNumber = newOrderNumber();
    }

    const order = await manager.save(Order, {
      ...stamp,
      orderNumber,
      cartId: p.cartId,
      userId: p.userId,
      guestSessionId: p.guestSessionId,
      contactEmail: p.contactEmail,
      sellerId: p.sellerId,
      status: OrderStatus.PENDING,
      deliveryType: p.deliveryType,
      total,
      subtotal,
      deliveryCharge: p.quote.charge,
      discountAmount: 0,
      payableAmount: payable,
      systemCommission: earned.commission,
      sellerAmount: earned.sellerAmount,
      commissionType: earned.type,
      commissionValue: earned.value,
      paymentGatewayId: p.gateway.id,
      paymentGatewayName: p.gateway.name,
      paymentGatewaySlug: p.gateway.slug,
      paymentStatus: PaymentStatus.DUE,
      amountPaid: 0,
      note: p.note,
      recipientName: p.recipientName,
      recipientPhone: p.recipientPhone,
      deliveryAddress: p.addressLine,
      city: p.city,
      state: p.state,
      zipCode: p.postalCode,
      countryCode: p.countryCode,
      countryName: countryName(p.countryCode),
      deliveryEstimatedDays: p.quote.estimatedDays,
      shippingZoneName: p.quote.zone?.name ?? null,
    });

    // The stock history: what each line took, tied to this order.
    await recordStockMovements(
      manager,
      p.lines.map((l) => ({ skuId: l.skuId, change: -l.quantity, reason: StockReason.ORDER_PLACED, orderId: order.id, note: `Order ${orderNumber}` })),
      p.placedBy,
    );

    const birds = await this.birdSnapshots(manager, p.lines.map((l) => l.skuId));
    await manager.save(
      OrderItem,
      p.lines.map((l, index) => ({
        ...stamp,
        orderId: order.id,
        sellerProductId: l.productId,
        sellerProductSkuId: l.skuId,
        productName: l.productName,
        skuData: {
          code: l.skuCode,
          label: l.skuLabel,
          imageUrl: l.skuImageUrl,
          thumbnailUrl: l.thumbnailUrl,
          slug: l.productSlug,
          // The bird as it was sold. Later edits to the SKU must not change what the buyer bought.
          ...(birds.get(l.skuId) ? { bird: birds.get(l.skuId) } : {}),
        },
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        // the SKU's price at order time; a proposal line is payable at the proposal price
        unitDiscountedPrice: l.proposal ? l.proposal.skuUnitPayable : l.unitPayable,
        totalPrice: round2(l.unitPrice * l.quantity),
        totalDiscountedPrice: round2((l.proposal ? l.proposal.skuUnitPayable : l.unitPayable) * l.quantity),
        proposalId: l.proposal?.id ?? null,
        unitProposalPrice: l.proposal ? l.proposal.unitPrice : null,
        totalProposalPrice: l.proposal ? round2(l.proposal.unitPrice * l.quantity) : null,
        systemCommission: earned.lines[index].commission,
        sellerAmount: earned.lines[index].sellerAmount,
      })),
    );
    await this.useProposals(manager, p, order.id);

    const payment = await manager.save(Payment, {
      ...stamp,
      orderId: order.id,
      userId: p.userId,
      paymentGatewayId: p.gateway.id,
      paymentGatewayName: p.gateway.name,
      paymentGatewaySlug: p.gateway.slug,
      status: PaymentStatus.DUE,
      amount: payable,
      transactionId: p.proof?.transactionId ?? p.proof?.transactionReference ?? p.proof?.reference ?? null,
      metaData: p.proof ? { proof: p.proof } : null,
    });
    await manager.save(PaymentStatusHistory, {
      ...stamp,
      orderId: order.id,
      paymentId: payment.id,
      fromStatus: null,
      status: PaymentStatus.DUE,
      amount: 0,
      amountPaidAfter: 0,
      note: p.historyNote,
    });
    await manager.save(OrderStatusHistory, {
      ...stamp,
      orderId: order.id,
      fromStatus: null,
      status: OrderStatus.PENDING,
      note: p.historyNote,
    });
    return order.id;
  }

  /** The pigeon facts of each SKU, for the order line. Only SKUs that have any are returned. */
  private async birdSnapshots(manager: EntityManager, skuIds: number[]) {
    const out = new Map<number, Record<string, unknown>>();
    if (skuIds.length === 0) return out;
    const skus = await manager.find(SellerProductSku, {
      where: skuIds.map((id) => ({ id })),
      relations: { product: true, parents: true },
    });
    for (const k of skus) {
      const parent = (role: string) => {
        const x = (k.parents ?? []).find((q) => q.role === role);
        return x && (x.name || x.ringNumber) ? { name: x.name, ringNumber: x.ringNumber } : null;
      };
      const bird = {
        ringNumber: k.ringNumber,
        hatchDate: k.hatchDate,
        vaccineName: k.vaccineName,
        vaccinatedOn: k.vaccinatedOn,
        breed: k.product?.breed ?? null,
        bloodline: k.product?.bloodline ?? null,
        sire: parent('sire'),
        dam: parent('dam'),
      };
      if (Object.values(bird).some((v) => v !== null && v !== undefined)) out.set(k.id, bird);
    }
    return out;
  }

  // ---- changing an order's status ----


  async changeOrderStatus(
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

      // A return that is open or finished already depends on this order staying as it is.
      if (to === OrderStatus.CANCELLED) await assertNoLiveReturns(manager, order.id, 'Cancelling the order');
      const items = await manager.find(OrderItem, { where: { orderId: order.id } });
      if (to === OrderStatus.CANCELLED) {
        await this.giveBack(manager, items);
        await this.logStock(manager, items, order, StockReason.ORDER_CANCELLED, 1, actor);
      } else if (from === OrderStatus.CANCELLED) {
        // Money already being sent back (or sent back) blocks a reopen; an untouched refund is voided.
        await this.closeOnReopen(manager, order, actor);
        await this.takeAgain(manager, items);
        await this.logStock(manager, items, order, StockReason.ORDER_REOPENED, -1, actor);
      }

      await manager.update(Order, order.id, {
        status: to,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      // A cancelled order that had money paid needs that money sent back.
      if (to === OrderStatus.CANCELLED) await this.openOnCancel(manager, order, actor);
      // A cancelled order earns no commission; reopening a paid one earns it again.
      if (order.paymentStatus === PaymentStatus.PAID) {
        if (to === OrderStatus.CANCELLED) {
          await this.commission.revokeFromOrder(manager, order, 'Order cancelled', actor);
        } else if (from === OrderStatus.CANCELLED) {
          await this.commission.earnFromOrder(manager, order, actor);
        }
      }
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

  /** Writes the stock history for what a cancel or a reopen just moved. */
  private logStock(manager: EntityManager, items: OrderItem[], order: Order, reason: StockReason, sign: 1 | -1, actor: StatusActor) {
    return recordStockMovements(
      manager,
      this.bySku(items).map(([skuId, quantity]) => ({ skuId, change: sign * quantity, reason, orderId: order.id, note: `Order ${order.orderNumber}` })),
      actor,
    );
  }

  /** Quantities per SKU in id order, so concurrent updates lock rows in one order. */
  private bySku(items: OrderItem[]): [number, number][] {
    const totals = new Map<number, number>();
    for (const item of items) {
      totals.set(item.sellerProductSkuId, (totals.get(item.sellerProductSkuId) ?? 0) + item.quantity);
    }
    return [...totals.entries()].sort((a, b) => a[0] - b[0]);
  }

  // ---- recording and reversing payments ----


  async record(
    orderId: number,
    dto: RecordPaymentDto,
    uploads: Express.Multer.File[] | undefined,
    actor: StatusActor,
    scope: OrderScope = {},
  ) {
    const list = this.files.validate(uploads);
    if (list.length === 0) {
      throw new BadRequestException('Attach at least one image or file as proof of payment');
    }
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException('paidAt cannot be in the future');
    }

    // Fail early, before storing any file, when the order cannot take a payment.
    const probe = await this.db.order.findOne({
      where: { id: orderId, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) },
    });
    if (!probe) throw new NotFoundException('Order not found');

    const stored = await this.files.store(list, FOLDER_PAYMENTS);
    try {
      const paymentId = await this.apply(orderId, dto, stored, paidAt, actor, scope);
      return { orderId, paymentId };
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
  }

  /**
   * Record a payment whose proof files are already stored (a buyer's "I have paid" message). No new upload is needed:
   * the staff member has checked the claim. Same rules and the same history as a normal receipt.
   */
  async recordWithStored(
    orderId: number,
    dto: RecordPaymentDto,
    stored: StoredAttachment[],
    actor: StatusActor,
    scope: OrderScope = {},
  ) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new BadRequestException('paidAt cannot be in the future');
    const paymentId = await this.apply(orderId, dto, stored, paidAt, actor, scope);
    return { orderId, paymentId };
  }

  /** The receipt itself, in one transaction. Returns the payment's id. */
  private apply(
    orderId: number,
    dto: RecordPaymentDto,
    stored: StoredAttachment[],
    paidAt: Date,
    actor: StatusActor,
    scope: OrderScope,
  ): Promise<number> {
    return this.db.order.manager.transaction(async (manager) => {

      const qb = manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId });
      if (scope.sellerId !== undefined) qb.andWhere('o.sellerId = :sellerId', { sellerId: scope.sellerId });
      const order = await qb.getOne();
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException('A cancelled order cannot take a payment');
      }
      const balance = round2(order.payableAmount - order.amountPaid);
      if (balance <= 0) throw new ConflictException('This order is already fully paid');
      const amount = dto.amount ?? balance;
      if (moneyGreater(amount, balance)) {
        throw new BadRequestException(`amount cannot be more than the balance due (${balance})`);
      }

      const paidTotal = round2(order.amountPaid + amount);
      const status = paidTotal >= order.payableAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
      const stamp = { updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name };

      // The row made at checkout (status due) becomes the first receipt.
      const open = await manager.findOne(Payment, {
        where: { orderId, status: PaymentStatus.DUE, reversedAt: IsNull() },
        order: { id: 'ASC' },
      });
      let payment: Payment;
      if (open) {
        await manager.update(Payment, open.id, {
          ...stamp,
          status,
          amount,
          paidAt,
          description: dto.description,
          transactionId: dto.transactionId ?? open.transactionId,
        });
        payment = { ...open, status, amount };
      } else {
        payment = await manager.save(Payment, {
          createdBy: actor.id,
          creatorType: actor.type,
          creatorName: actor.name,
          orderId,
          userId: order.userId,
          paymentGatewayId: order.paymentGatewayId,
          paymentGatewayName: order.paymentGatewayName,
          paymentGatewaySlug: order.paymentGatewaySlug,
          status,
          amount,
          paidAt,
          description: dto.description,
          transactionId: dto.transactionId ?? null,
        });
      }

      await manager.save(
        PaymentAttachment,
        stored.map((s) => ({
          ...s,
          paymentId: payment.id,
          orderId,
          createdBy: actor.id,
          creatorType: actor.type,
          creatorName: actor.name,
        })),
      );
      await manager.update(Order, orderId, { ...stamp, amountPaid: paidTotal, paymentStatus: status });
      await manager.save(PaymentStatusHistory, {
        orderId,
        paymentId: payment.id,
        fromStatus: order.paymentStatus,
        status,
        amount,
        amountPaidAfter: paidTotal,
        note: dto.description,
        createdBy: actor.id,
        creatorType: actor.type,
        creatorName: actor.name,
      });
      // Fully paid: the platform's commission on this order is now earned.
      if (status === PaymentStatus.PAID) await this.commission.earnFromOrder(manager, order, actor);
      return payment.id;
    
    });
  }

  /**
   * Undo one recorded payment (it never arrived, or was entered by mistake).
   * The row is kept with who reversed it and why, the order's total received
   * goes down, its payment status follows, and the history gets a line. A seller
   * can only undo a payment a seller recorded; an admin can undo any.
   */
  async reverse(
    orderId: number,
    paymentId: number,
    dto: ReversePaymentDto,
    actor: StatusActor,
    scope: OrderScope = {},
  ) {
    return this.db.order.manager.transaction(async (manager) => {
      const qb = manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId });
      if (scope.sellerId !== undefined) qb.andWhere('o.sellerId = :sellerId', { sellerId: scope.sellerId });
      const order = await qb.getOne();
      if (!order) throw new NotFoundException('Order not found');

      const payment = await manager.findOne(Payment, { where: { id: paymentId, orderId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.reversedAt) throw new ConflictException('This payment was already reversed');
      if (payment.status === PaymentStatus.DUE) {
        throw new ConflictException('This payment has not been received, so there is nothing to reverse');
      }
      const recordedBy = payment.updaterType ?? payment.creatorType;
      if (actor.type === AuthUserType.SELLER && recordedBy !== AuthUserType.SELLER) {
        throw new ForbiddenException('Only an admin can reverse a payment an admin recorded');
      }

      const received = payment.amount;
      const paidTotal = Math.max(0, round2(order.amountPaid - received));
      const status =
        paidTotal <= 0 ? PaymentStatus.DUE : paidTotal >= order.payableAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
      // Refunds and commission rest on a paid order, so it cannot stop being paid while a return is open or done.
      if (order.paymentStatus === PaymentStatus.PAID && status !== PaymentStatus.PAID) {
        await assertNoLiveReturns(manager, order.id, 'Reversing this payment');
      }

      await manager.update(Payment, payment.id, {
        status: PaymentStatus.DUE,
        reversedAt: new Date(),
        reversedBy: actor.id,
        reversedByType: actor.type,
        reversedByName: actor.name,
        reversalReason: dto.reason,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.update(Order, orderId, {
        amountPaid: paidTotal,
        paymentStatus: status,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.save(PaymentStatusHistory, {
        orderId,
        paymentId: payment.id,
        fromStatus: order.paymentStatus,
        status,
        amount: -received,
        amountPaidAfter: paidTotal,
        note: `Payment #${payment.id} reversed: ${dto.reason}`,
        createdBy: actor.id,
        creatorType: actor.type,
        creatorName: actor.name,
      });
      // No longer fully paid: take the commission back out.
      if (order.paymentStatus === PaymentStatus.PAID && status !== PaymentStatus.PAID) {
        await this.commission.revokeFromOrder(manager, order, `Payment #${payment.id} reversed: ${dto.reason}`, actor);
      }
      return { orderId, paymentId: payment.id, paymentStatus: status, amountPaid: paidTotal };
    });
  }

  // ---- posting an update on an order ----


  async postUpdate(
    orderId: number,
    dto: PostOrderUpdateDto,
    uploads: Express.Multer.File[] | undefined,
    actor: StatusActor,
    scope: OrderScope = {},
  ) {
    const list = this.files.validate(uploads);
    if (!dto.message && list.length === 0) {
      throw new BadRequestException('Write a message or attach a file');
    }
    const order = await this.db.order.findOne({
      where: { id: orderId, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const stored = await this.files.store(list, FOLDER_UPDATES);
    const stamp = { createdBy: actor.id, creatorType: actor.type, creatorName: actor.name };
    try {
      const id = await this.db.orderUpdate.manager.transaction(async (manager) => {
        const update = await manager.save(OrderUpdate, { ...stamp, orderId, message: dto.message ?? null });
        if (stored.length > 0) {
          await manager.save(
            OrderUpdateAttachment,
            stored.map((s) => ({ ...s, ...stamp, orderUpdateId: update.id })),
          );
        }
        return update.id;
      });
      return { orderId, updateId: id };
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
  }

  // ---- refund records for a cancelled order ----


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

  // ---- admin and seller orders: list, detail, status, bulk status, customers, catalog, options and create ----


  async listOrders(query: ListStaffOrderQueryDto, pagination: CursorPagination, viewer: AuthUserType, scope: OrderScope = {}) {
    if (query.minTotal !== undefined && query.maxTotal !== undefined && query.minTotal > query.maxTotal) {
      throw new BadRequestException('minTotal cannot be greater than maxTotal');
    }
    if (query.createdFrom && query.createdTo && new Date(query.createdFrom) > upperBound(query.createdTo)) {
      throw new BadRequestException('A "from" date cannot be after its "to" date');
    }
    const qb = this.db.order
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.seller', 's')
      .leftJoinAndSelect('o.items', 'i')
      .orderBy('o.id', 'DESC')
      .addOrderBy('i.id', 'ASC')
      .take(pagination.limit);
    if (pagination.cursor > 0) qb.andWhere('o.id < :cursor', { cursor: pagination.cursor });

    if (scope.sellerId !== undefined) qb.andWhere('o.sellerId = :scope', { scope: scope.sellerId });
    else {
      if (query.sellerId !== undefined) qb.andWhere('o.sellerId = :sid', { sid: query.sellerId });
      if (query.sellerSearch) qb.andWhere('s.name ILIKE :ss', { ss: likeContains(query.sellerSearch) });
    }
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.paymentStatus) qb.andWhere('o.paymentStatus = :ps', { ps: query.paymentStatus });
    if (query.userId !== undefined) qb.andWhere('o.userId = :uid', { uid: query.userId });
    if (query.owner === OrderOwnerKind.CUSTOMER) qb.andWhere('o.userId IS NOT NULL');
    if (query.owner === OrderOwnerKind.GUEST) qb.andWhere('o.userId IS NULL');
    if (query.orderNumber) qb.andWhere('o.orderNumber ILIKE :on', { on: likeContains(query.orderNumber) });
    if (query.gatewayId !== undefined) qb.andWhere('o.paymentGatewayId = :gw', { gw: query.gatewayId });
    if (query.deliveryType) qb.andWhere('o.deliveryType = :dt', { dt: query.deliveryType });
    if (query.countryCode) qb.andWhere('o.countryCode = :cc', { cc: query.countryCode });
    if (query.minTotal !== undefined) qb.andWhere('o.payableAmount >= :minT', { minT: query.minTotal });
    if (query.maxTotal !== undefined) qb.andWhere('o.payableAmount <= :maxT', { maxT: query.maxTotal });
    if (query.createdFrom) qb.andWhere('o.createdAt >= :cf', { cf: new Date(query.createdFrom) });
    if (query.createdTo) qb.andWhere('o.createdAt <= :ct', { ct: upperBound(query.createdTo) });
    if (query.customerSearch) {
      qb.andWhere(
        `(o.recipientName ILIKE :cs OR o.recipientPhone ILIKE :cs OR o.contactEmail ILIKE :cs
          OR EXISTS (SELECT 1 FROM "user" u WHERE u.id = o."userId" AND (u.name ILIKE :cs OR u.email ILIKE :cs OR u.phone ILIKE :cs)))`,
        { cs: likeContains(query.customerSearch) },
      );
    }

    const page = getCursorPaginateData(await qb.getMany(), pagination.limit);
    return {
      results: page.results.map((o) => this.viewSummary(o, viewer)),
      nextCursor: page.nextCursor,
    };
  }

  async orderDetail(id: number, viewer: AuthUserType, scope: OrderScope = {}) {
    const order = await this.load(id);
    if (!order || (scope.sellerId !== undefined && order.sellerId !== scope.sellerId)) {
      throw new NotFoundException('Order not found');
    }
    const full = await this.full(order, viewer);
    const account = order.userId
      ? await this.db.user.findOne({
          where: { id: order.userId },
          select: { id: true, name: true, email: true, phone: true, status: true },
        })
      : null;
    return {
      ...full,
      account: account && {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        status: account.status,
      },
    };
  }

  async changeStatus(id: number, dto: ChangeOrderStatusDto, actor: StatusActor, viewer: AuthUserType, scope: OrderScope = {}) {
    await this.changeOrderStatus(id, dto.status, actor, { note: dto.note, scope });
    return this.orderDetail(id, viewer, scope);
  }

  /**
   * Moves several of the seller's orders to one new status. The orders must all be in the same status now, and the
   * move must be allowed from it. Each order is moved on its own, so one failing does not undo the others.
   */
  async bulkChangeStatus(dto: BulkChangeOrderStatusDto, actor: StatusActor, scope: OrderScope) {
    const orders = await this.db.order.find({
      where: { id: In(dto.orderIds), ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) },
      select: { id: true, orderNumber: true, status: true },
    });
    if (orders.length !== dto.orderIds.length) throw new NotFoundException('Some of these orders were not found');
    const from = orders[0].status;
    if (orders.some((o) => o.status !== from)) {
      throw new BadRequestException('All the orders must be in the same status. Pick orders that are all waiting for the same step.');
    }
    const denied = transitionDenied(actor.type, from, dto.status);
    if (denied) throw new BadRequestException(denied);

    const results: Array<{ id: number; orderNumber: string; ok: boolean; error?: string }> = [];
    for (const o of [...orders].sort((a, b) => a.id - b.id)) {
      try {
        await this.changeOrderStatus(o.id, dto.status, actor, { note: dto.note, scope });
        results.push({ id: o.id, orderNumber: o.orderNumber, ok: true });
      } catch (e) {
        results.push({ id: o.id, orderNumber: o.orderNumber, ok: false, error: e instanceof Error ? e.message : 'Could not change this order' });
      }
    }
    return { status: dto.status, updated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  }

  /** Find a customer account by exact email or by mobile number (any common format). */
  async findCustomers(q: string) {
    const qb = this.db.user.createQueryBuilder('u').orderBy('u.id', 'ASC').take(5);
    if (q.includes('@')) {
      qb.where('LOWER(u.email) = LOWER(:email)', { email: q });
    } else {
      const digits = q.replace(/\D/g, '');
      if (digits.length < 6) throw new BadRequestException('Enter a full email address or mobile number');
      qb.where(`regexp_replace(u.phone, '\\D', '', 'g') LIKE :tail`, { tail: `%${digits}` });
    }
    const users = await qb.getMany();
    return {
      results: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        canOrder: getUserAccess(u).canUse,
        status: u.status,
      })),
    };
  }

  /** The seller's buyable products with their variants, for picking order items. */
  async catalog(query: StaffCatalogQueryDto, scope: OrderScope) {
    const sellerId = await this.resolveSeller(query.sellerId, scope);
    const qb = this.db.sellerProduct
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.skus', 'k', 'k.isActive = true AND k.deletedAt IS NULL')
      .leftJoinAndSelect('k.variants', 'v')
      .leftJoinAndSelect('v.attribute', 'a')
      .leftJoinAndSelect('v.attributeValue', 'av')
      .where('p.sellerId = :sellerId', { sellerId })
      .andWhere('p.status = :ps', { ps: ProductStatus.APPROVED })
      .andWhere('p.activeStatus = :pa', { pa: ProductActiveStatus.ACTIVE })
      .orderBy('p.id', 'DESC')
      .addOrderBy('k.id', 'ASC')
      .take(30);
    if (query.search) qb.andWhere('p.name ILIKE :q', { q: likeContains(query.search) });
    const products = await qb.getMany();
    return {
      results: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        thumbnailUrl: p.thumbnailUrl ?? null,
        skus: p.skus.map((k) => ({
          id: k.id,
          code: k.sku,
          label: this.label(k),
          imageUrl: k.imageUrl ?? null,
          price: Number(k.price),
          payable: effectivePrice(k),
          quantity: k.quantity,
        })),
      })),
    };
  }

  /** Delivery prices and payment methods for the order form. */
  async orderOptions(countryCode: string | undefined, subtotal: number | undefined) {
    return {
      countries: listCountries(),
      countryCode: countryCode ?? null,
      countryName: countryCode ? countryName(countryCode) : null,
      deliveryOptions: countryCode ? await this.deliveryOptions(countryCode, subtotal ?? 0) : [],
      paymentGateways: await this.gatewayOptions(),
    };
  }

  async createOrder(dto: CreateStaffOrderDto, actor: StatusActor, scope: OrderScope) {
    if (scope.sellerId !== undefined && dto.sellerId !== undefined && dto.sellerId !== scope.sellerId) {
      throw new ForbiddenException('A seller can only create orders for their own shop');
    }
    const sellerId = await this.resolveSeller(dto.sellerId, scope);

    let account: { id: number; email: string | null } | null = null;
    if (dto.userId !== undefined) {
      const user = await this.db.user.findOne({ where: { id: dto.userId } });
      if (!user) throw new BadRequestException('That customer account does not exist');
      if (!getUserAccess(user).canUse) throw new BadRequestException('That customer account is suspended');
      account = { id: user.id, email: user.email ?? null };
    }

    const skuIds = dto.items.map((i) => i.sellerProductSkuId);
    if (new Set(skuIds).size !== skuIds.length) {
      throw new BadRequestException('Each variant can appear once; raise its quantity instead');
    }
    const skus = await this.db.sellerProductSku.find({
      where: skuIds.map((id) => ({ id })),
      relations: { variants: { attribute: true, attributeValue: true } },
    });
    const products = await this.db.sellerProduct.find({
      where: [...new Set(dto.items.map((i) => i.sellerProductId))].map((id) => ({ id })),
    });

    const lines: PlacementLine[] = dto.items.map((item, index) => {
      const sku = skus.find((s) => s.id === item.sellerProductSkuId);
      const product = products.find((p) => p.id === item.sellerProductId);
      const where = `Item ${index + 1}`;
      if (!sku || !product || sku.sellerProductId !== product.id || product.sellerId !== sellerId) {
        throw new BadRequestException(`${where} does not belong to this seller`);
      }
      if (!this.buyable(product, sku)) throw new BadRequestException(`${product.name} cannot be sold right now`);
      if (item.quantity > sku.quantity) {
        throw new BadRequestException(`Only ${sku.quantity} of ${product.name} in stock`);
      }
      return {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        thumbnailUrl: product.thumbnailUrl ?? null,
        skuId: sku.id,
        skuCode: sku.sku,
        skuLabel: this.label(sku),
        skuImageUrl: sku.imageUrl ?? null,
        quantity: item.quantity,
        unitPrice: Number(sku.price),
        unitPayable: effectivePrice(sku),
      };
    });

    const gateway = await this.activeGateway(dto.paymentGatewayId);
    // Staff may add the payment details later, so nothing is required here.
    const proof = this.checkProof(gateway, dto.paymentProof, false);
    const quote = await this.shipping.quote(dto.countryCode, dto.deliveryType);

    const orderId = await this.db.order.manager.transaction((manager) =>
      this.insert(manager, {
        userId: account?.id ?? null,
        guestSessionId: null,
        sellerId,
        cartId: null,
        lines,
        gateway,
        proof,
        quote,
        deliveryType: dto.deliveryType,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        contactEmail: dto.contactEmail ?? account?.email ?? null,
        countryCode: dto.countryCode,
        state: dto.state ?? null,
        city: dto.city,
        addressLine: dto.addressLine,
        postalCode: dto.postalCode ?? null,
        note: dto.note ?? null,
        placedBy: { id: actor.id, type: actor.type, name: actor.name },
        historyNote: `Order placed by ${actor.type === AuthUserType.ADMIN ? 'admin' : 'seller'} ${actor.name}`,
      }),
    );
    return this.orderDetail(orderId, actor.type, scope);
  }

  private async resolveSeller(sellerId: number | undefined, scope: OrderScope): Promise<number> {
    const id = scope.sellerId ?? sellerId;
    if (id === undefined) throw new BadRequestException('sellerId is required');
    const seller = await this.db.seller.findOne({ where: { id } });
    if (
      !seller ||
      seller.status !== SellerStatus.APPROVED ||
      seller.activeStatus !== SellerActiveStatus.ACTIVE
    ) {
      throw new BadRequestException('That seller is not approved and active');
    }
    return seller.id;
  }

  private buyable(product: SellerProduct, sku: SellerProductSku) {
    return (
      !product.deletedAt &&
      product.status === ProductStatus.APPROVED &&
      product.activeStatus === ProductActiveStatus.ACTIVE &&
      !sku.deletedAt &&
      sku.isActive
    );
  }

  private label(sku: SellerProductSku) {
    return (sku.variants ?? [])
      .filter((v) => v.attribute && v.attributeValue)
      .map((v) => `${v.attribute.name}: ${v.attributeValue.name}`)
      .join(' / ');
  }

  // ---- the payment list and payment details ----


  async listPayments(query: ListPaymentQueryDto, pagination: CursorPagination, sellerScope?: number) {
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

  async paymentDetails(id: number, sellerScope?: number) {
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
      attachments: attachments.map((a) => this.attachment(a)),
      order: {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        payable: o.payableAmount,
        amountPaid: o.amountPaid,
        balanceDue: tidy(o.payableAmount - o.amountPaid),
      },
      history: history.map((h) => this.paymentHistory(h)),
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
      reversal: this.reversal(p),
      recordedBy: p.status === 'due' || p.reversedAt ? null : { name: p.updaterName ?? p.creatorName, type: p.updaterType ?? p.creatorType },
      createdAt: p.createdAt,
    };
  }

  // ---- the refund list and the steps to send money back ----


  /** Cancelled-order refunds, newest first. */
  async listRefunds(query: ListRefundsQueryDto, page: PageRequest, scope: RefundScope) {
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
  async refundSummary(scope: RefundScope) {
    const rows: { status: string; n: string }[] = await this.db.orderRefund.query(
      `select r.status, count(*) n from order_refund r where r."deletedAt" is null and r.kind = 'cancelled_order' and ($1::int is null or r."sellerId" = $1) group by r.status`,
      [scope.sellerId ?? null],
    );
    const n = (s: RefundStatus) => Number(rows.find((r) => r.status === s)?.n ?? 0);
    return { needsToRefund: n(RefundStatus.NEEDS_TO_REFUND), processing: n(RefundStatus.PROCESSING), refunded: n(RefundStatus.REFUNDED) };
  }

  /** One refund with its order and history. */
  async refundDetail(id: number, scope: RefundScope) {
    const r = await this.db.orderRefund.findOne({ where: { id, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) }, relations: { history: true } });
    if (!r) throw new NotFoundException('Refund not found');
    return refundRecordView(r);
  }

  /** The proof and the amount a refunded step needs. The seller must attach a file; an admin may. */
  private async checkRefunded(order: Order, dto: { amount?: number; note?: string }, uploads: Express.Multer.File[] | undefined, actor: StatusActor, expected?: number) {
    this.assertAmountMatches(order, dto.amount, expected);
    if (!dto.note || dto.note.trim().length < 3) throw new BadRequestException('Write a note: how and when the money was sent');
    const list = this.files.validate(uploads);
    if (list.length === 0 && actor.type === AuthUserType.SELLER) throw new BadRequestException('Attach a screenshot or a file that proves you sent the money back');
    return list;
  }

  /** Move a refund to a new status. Everything is recorded in the history. */
  async changeRefund(id: number, dto: ChangeRefundStatusDto, uploads: Express.Multer.File[] | undefined, actor: StatusActor, scope: RefundScope) {
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
    const stored: StoredAttachment[] = list.length ? await this.files.store(list, FOLDER_REFUNDS) : [];
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
        await this.log(manager, r, from, dto.status, dto.note?.trim() ?? null, dto.status === RefundStatus.REFUNDED ? (dto.amount ?? null) : null, stored, actor);
        await this.syncOrder(manager, r.orderId);
      });
    } catch (e) {
      await this.files.discard(stored);
      throw e;
    }
    return this.refundDetail(id, scope);
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
    const stored = list.length ? await this.files.store(list, FOLDER_REFUNDS) : [];
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
        await this.log(manager, r, null, status, dto.note?.trim() ?? 'Added by an admin', refunded ? (dto.amount ?? null) : null, stored, actor);
        return r.id;
      });
      return this.refundDetail(id, {});
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
    const stored = list.length ? await this.files.store(list, FOLDER_REFUNDS) : [];
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
        await this.log(manager, r, null, status, dto.note?.trim() ?? 'Added by an admin', refunded ? (dto.amount ?? null) : null, stored, actor);
        await this.syncOrder(manager, orderId);
        return r.id;
      });
      return this.refundDetail(id, {});
    } catch (e) {
      await this.files.discard(stored);
      throw e;
    }
  }
}
