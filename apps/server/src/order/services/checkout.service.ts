import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CartOwner } from '../../auth/guards/optional-customer.guard';
import { CartViewService } from '../../cart/services/cart-view.service';
import { DatabaseService } from '../../database/database.service';
import { Cart } from '../../database/entities/cart/cart.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ShippingZoneService } from '../../settings/services/shipping-zone.service';
import { countryName } from '../../settings/utils/countries';
import { PlaceOrderDto } from '../dtos/order.dtos';
import { OrderPlacementService } from './order-placement.service';
import { OrderViewService } from './order-view.service';

/** Checkout of one cart into one order. Works for customers and guests. */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly db: DatabaseService,
    private readonly carts: CartViewService,
    private readonly shipping: ShippingZoneService,
    private readonly placement: OrderPlacementService,
    private readonly views: OrderViewService,
  ) {}

  /** What the checkout page needs: the live cart, delivery prices for a country, and the ways to pay. */
  async options(owner: CartOwner, cartId: number, countryCode?: string) {
    this.requireOwner(owner);
    const cart = await this.ownedActiveCart(owner, cartId);
    const view = (await this.carts.build(cart.id))!;
    return {
      cart: view,
      countryCode: countryCode ?? null,
      countryName: countryCode ? countryName(countryCode) : null,
      deliveryOptions: countryCode
        ? await this.placement.deliveryOptions(countryCode, view.totals.payableTotal)
        : [],
      paymentGateways: await this.placement.gatewayOptions(),
    };
  }

  /** Turn the cart into an order: re-check stock, take it, record the order, close the cart. */
  async place(owner: CartOwner, cartId: number, dto: PlaceOrderDto) {
    this.requireOwner(owner);

    const gateway = await this.placement.activeGateway(dto.paymentGatewayId);
    const proof = this.placement.checkProof(gateway, dto.paymentProof, true);
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

      const id = await this.placement.insert(manager, {
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

    return this.views.detailById(orderId);
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

  private requireOwner(owner: CartOwner) {
    if (!owner.userId && !owner.sessionId) {
      throw new BadRequestException('Guests must send the x-cart-session header to check out');
    }
  }
}
