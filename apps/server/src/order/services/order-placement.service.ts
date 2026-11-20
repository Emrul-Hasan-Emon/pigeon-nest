import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { Order } from '../../database/entities/order/order.entity';
import { OrderItem } from '../../database/entities/order/order-item.entity';
import { OrderStatusHistory } from '../../database/entities/order/order-status-history.entity';
import { PaymentGateway } from '../../database/entities/payment/payment-gateway.entity';
import { PaymentStatusHistory } from '../../database/entities/payment/payment-status-history.entity';
import { Payment } from '../../database/entities/payment/payment.entity';
import { SellerProductSku } from '../../database/entities/product/seller-product-sku.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { DeliveryType } from '../../database/enums/delivery-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { GATEWAY_TYPE_LABELS, proofFieldsFor } from '../../payment/utils/payment-gateway.util';
import { ShippingQuote, ShippingZoneService } from '../../settings/services/shipping-zone.service';
import { countryName } from '../../settings/utils/countries';
import { newOrderNumber } from '../utils/order-number.util';
import { tidy } from '../../shared/utils/money.util';

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
  unitPayable: number;
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

/** What checkout (customer) and order entry (staff) share: stock, the order, its lines, payment and histories. */
@Injectable()
export class OrderPlacementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly shipping: ShippingZoneService,
  ) {}

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

    await manager.save(
      OrderItem,
      p.lines.map((l) => ({
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
        },
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        unitDiscountedPrice: l.unitPayable,
        totalPrice: round2(l.unitPrice * l.quantity),
        totalDiscountedPrice: round2(l.unitPayable * l.quantity),
      })),
    );

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
}
