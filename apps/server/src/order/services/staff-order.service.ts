import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getUserAccess } from '../../auth/policies/user-access.policy';
import { DatabaseService } from '../../database/database.service';
import { SellerProductSku } from '../../database/entities/product/seller-product-sku.entity';
import { SellerProduct } from '../../database/entities/product/seller-product.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ProductActiveStatus } from '../../database/enums/product-active-status.enum';
import { ProductStatus } from '../../database/enums/product-status.enum';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { ShippingZoneService } from '../../settings/services/shipping-zone.service';
import { countryName, listCountries } from '../../settings/utils/countries';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { effectivePrice } from '../../storefront/storefront-product.service';
import { In } from 'typeorm';
import { transitionDenied } from '../utils/order-status-rules';
import {
  BulkChangeOrderStatusDto,
  ChangeOrderStatusDto,
  CreateStaffOrderDto,
  ListStaffOrderQueryDto,
  OrderOwnerKind,
  StaffCatalogQueryDto,
} from '../dtos/order-staff.dtos';
import { OrderPlacementService, PlacementLine, round2 } from './order-placement.service';
import { OrderScope, OrderStatusService, StatusActor } from './order-status.service';
import { OrderViewService } from './order-view.service';

function upperBound(value: string): Date {
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date;
}

/** Orders as the admin (all sellers) and a seller (own orders) work with them. */
@Injectable()
export class StaffOrderService {
  constructor(
    private readonly db: DatabaseService,
    private readonly views: OrderViewService,
    private readonly status: OrderStatusService,
    private readonly placement: OrderPlacementService,
    private readonly shipping: ShippingZoneService,
  ) {}

  async list(query: ListStaffOrderQueryDto, pagination: CursorPagination, viewer: AuthUserType, scope: OrderScope = {}) {
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
      results: page.results.map((o) => this.views.summary(o, viewer)),
      nextCursor: page.nextCursor,
    };
  }

  async detail(id: number, viewer: AuthUserType, scope: OrderScope = {}) {
    const order = await this.views.load(id);
    if (!order || (scope.sellerId !== undefined && order.sellerId !== scope.sellerId)) {
      throw new NotFoundException('Order not found');
    }
    const full = await this.views.full(order, viewer);
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
    await this.status.change(id, dto.status, actor, { note: dto.note, scope });
    return this.detail(id, viewer, scope);
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
        await this.status.change(o.id, dto.status, actor, { note: dto.note, scope });
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
  async options(countryCode: string | undefined, subtotal: number | undefined) {
    return {
      countries: listCountries(),
      countryCode: countryCode ?? null,
      countryName: countryCode ? countryName(countryCode) : null,
      deliveryOptions: countryCode ? await this.placement.deliveryOptions(countryCode, subtotal ?? 0) : [],
      paymentGateways: await this.placement.gatewayOptions(),
    };
  }

  async create(dto: CreateStaffOrderDto, actor: StatusActor, scope: OrderScope) {
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

    const gateway = await this.placement.activeGateway(dto.paymentGatewayId);
    // Staff may add the payment details later, so nothing is required here.
    const proof = this.placement.checkProof(gateway, dto.paymentProof, false);
    const quote = await this.shipping.quote(dto.countryCode, dto.deliveryType);

    const orderId = await this.db.order.manager.transaction((manager) =>
      this.placement.insert(manager, {
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
    return this.detail(orderId, actor.type, scope);
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
}
