import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CartOwner } from '../../auth/guards/optional-customer.guard';
import { CartViewService } from '../../cart/services/cart-view.service';
import { DatabaseService } from '../../database/database.service';
import { Cart } from '../../database/entities/cart/cart.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ShippingZoneService } from '../../settings/services/shipping-zone.service';
import { countryName } from '../../settings/utils/countries';
import { tidy } from '../../shared/utils/money.util';
import { PlaceOrderDto, UserOrderQueryDto } from '../dtos/order.dtos';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { likeContains } from '../../shared/utils/like.util';
import { pageResult, resolvePage } from '../../shared/utils/page-paginate.util';
import { normalizePhone } from '../../shared/utils/phone.util';
import { CommonOrderService } from './common-order.service';

/**
 * What a customer (or a guest with an x-cart-session header) does with orders: check out a cart into an order, list their
 * orders, read one, track one by number and phone, and cancel one while it is pending.
 */
@Injectable()
export class UserOrderService {
  constructor(
    private readonly db: DatabaseService,
    private readonly carts: CartViewService,
    private readonly shipping: ShippingZoneService,
    private readonly common: CommonOrderService,
  ) {}

  // ---- checkout: one cart becomes one order ----


  /** What the checkout page needs: the live cart, delivery prices for a country, and the ways to pay. */
  async checkoutOptions(owner: CartOwner, cartId: number, countryCode?: string) {
    this.requireOwner(owner);
    const cart = await this.ownedActiveCart(owner, cartId);
    const view = (await this.carts.build(cart.id))!;
    return {
      cart: view,
      countryCode: countryCode ?? null,
      countryName: countryCode ? countryName(countryCode) : null,
      deliveryOptions: countryCode
        ? await this.common.deliveryOptions(countryCode, view.totals.payableTotal)
        : [],
      paymentGateways: await this.common.gatewayOptions(),
    };
  }

  /** Turn the cart into an order: re-check stock, take it, record the order, close the cart. */
  async place(owner: CartOwner, cartId: number, dto: PlaceOrderDto) {
    this.requireOwner(owner);

    const gateway = await this.common.activeGateway(dto.paymentGatewayId);
    const proof = this.common.checkProof(gateway, dto.paymentProof, true);
    const quote = await this.shipping.quote(dto.countryCode, dto.deliveryType);
    const account = await this.account(owner);
    // A signed-in customer is recorded by account name; a guest by the name they typed.
    const buyerName = account?.name ?? dto.recipientName;

    const orderId = await this.db.order.manager.transaction(async (manager) => {
      // The cart row is locked, so nothing can change its items while we order.
      const locked = await manager
        .createQueryBuilder(Cart, 'c')
        .setLock('pessimistic_write')
        .where('c.id = :cartId', { cartId })
        .andWhere(owner.userId ? 'c.userId = :userId' : 'c.sessionId = :sessionId', {
          userId: owner.userId,
          sessionId: owner.sessionId,
        })
        .getOne();
      if (!locked) throw new NotFoundException('Cart not found');
      if (!locked.isActive) throw new ConflictException('This cart has already been ordered');

      const cart = await this.carts.load(cartId);
      const view = this.carts.fromCart(cart!);
      if (view.lines.length === 0) throw new ConflictException('The cart is empty');
      if (!view.canCheckout) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'Some items in this cart cannot be bought right now. Update the cart and try again.',
          issues: view.issues,
        });
      }

      if (dto.expectedItemsTotal != null && tidy(dto.expectedItemsTotal) !== tidy(view.totals.payableTotal)) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'PRICE_CHANGED',
          message: `The price of this cart changed from ${tidy(dto.expectedItemsTotal)} to ${tidy(view.totals.payableTotal)}. Check the new total and place the order again.`,
          currentTotal: view.totals.payableTotal,
          notices: view.notices,
        });
      }

      const id = await this.common.insert(manager, {
        userId: owner.userId,
        guestSessionId: owner.userId ? null : owner.sessionId,
        sellerId: cart!.sellerId,
        cartId: cart!.id,
        lines: view.lines.map((l) => ({
          productId: l.product!.id,
          productName: l.product!.name,
          productSlug: l.product!.slug,
          thumbnailUrl: l.product!.thumbnailUrl,
          skuId: l.sku!.id,
          skuCode: l.sku!.code,
          skuLabel: l.sku!.label,
          skuImageUrl: l.sku!.imageUrl,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unitPayable: l.unitPayable,
          proposal:
            l.proposal?.applied
              ? { id: l.proposal.id, unitPrice: l.proposal.unitPrice, skuUnitPayable: l.skuUnitPayable }
              : null,
        })),
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
        placedBy: { id: owner.userId, type: AuthUserType.USER, name: buyerName },
        historyNote: 'Order placed',
      });

      // The cart stays, as a record of what was ordered, but is no longer active.
      await manager.update(Cart, cart!.id, {
        isActive: false,
        orderId: id,
        updatedBy: owner.userId,
        updaterType: AuthUserType.USER,
        updaterName: buyerName,
      });
      return id;
    });

    return this.common.detailById(orderId);
  }

  private async account(owner: CartOwner) {
    if (!owner.userId) return null;
    return this.db.user.findOne({ where: { id: owner.userId }, select: { id: true, name: true, email: true } });
  }

  private async ownedActiveCart(owner: CartOwner, cartId: number) {
    const cart = await this.db.cart.findOne({
      where: owner.userId
        ? { id: cartId, userId: owner.userId, isActive: true }
        : { id: cartId, sessionId: owner.sessionId!, isActive: true },
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  // ---- their orders ----


  async list(owner: CartOwner, query: UserOrderQueryDto) {
    this.requireOwner(owner);
    const page = resolvePage(query);
    const qb = this.db.order
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.seller', 's')
      .leftJoinAndSelect('o.items', 'i')
      .where(owner.userId ? 'o.userId = :userId' : 'o.guestSessionId = :sessionId', {
        userId: owner.userId,
        sessionId: owner.sessionId,
      });
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.paymentStatus) qb.andWhere('o.paymentStatus = :ps', { ps: query.paymentStatus });
    if (query.search) qb.andWhere('o.orderNumber ILIKE :q', { q: likeContains(query.search) });
    const [rows, total] = await qb
      .orderBy('o.id', 'DESC')
      .addOrderBy('i.id', 'ASC')
      .skip(page.offset)
      .take(page.pageSize)
      .getManyAndCount();
    return pageResult(
      rows.map((o) => this.common.viewSummary(o, AuthUserType.USER)),
      total,
      page,
    );
  }

  async detail(owner: CartOwner, orderId: number) {
    this.requireOwner(owner);
    const order = await this.common.load(orderId);
    if (!order || !this.owns(owner, order)) throw new NotFoundException('Order not found');
    return this.common.full(order, AuthUserType.USER);
  }

  /** A guest without a session looks an order up by its number and the phone it was placed with. */
  async track(orderNumber: string, phone: string) {
    const order = await this.db.order.findOne({ where: { orderNumber: orderNumber.toUpperCase() } });
    const wanted = normalizePhone(phone);
    if (!order || !wanted || normalizePhone(order.recipientPhone) !== wanted) {
      throw new NotFoundException('No order matches that number and phone');
    }
    return this.common.detailById(order.id);
  }

  async cancel(owner: CartOwner, orderId: number, reason?: string) {
    this.requireOwner(owner);
    const actor = await this.actor(owner, orderId);
    await this.common.changeOrderStatus(orderId, OrderStatus.CANCELLED, actor, {
      note: reason ?? 'Cancelled by the customer',
      scope: owner.userId ? { userId: owner.userId } : { guestSessionId: owner.sessionId! },
    });
    return this.detail(owner, orderId);
  }

  private async actor(owner: CartOwner, orderId: number) {
    if (owner.userId) {
      const user = await this.db.user.findOne({ where: { id: owner.userId }, select: { id: true, name: true } });
      return { id: owner.userId, type: AuthUserType.USER, name: user?.name ?? 'Customer' };
    }
    const order = await this.db.order.findOne({
      where: { id: orderId, guestSessionId: owner.sessionId! },
      select: { id: true, recipientName: true },
    });
    return { id: null, type: AuthUserType.USER, name: order?.recipientName ?? 'Guest' };
  }

  private owns(owner: CartOwner, order: { userId: number | null; guestSessionId: string | null }) {
    return owner.userId ? order.userId === owner.userId : order.guestSessionId === owner.sessionId;
  }

  private requireOwner(owner: CartOwner) {
    if (!owner.userId && !owner.sessionId) {
      throw new BadRequestException('Guests must send the x-cart-session header to use their orders');
    }
  }
}
