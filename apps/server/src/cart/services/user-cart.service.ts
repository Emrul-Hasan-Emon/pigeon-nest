import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EntityManager, QueryFailedError } from 'typeorm';
import { CartOwner } from '../../auth/guards/optional-customer.guard';
import { DatabaseService } from '../../database/database.service';
import { Cart } from '../../database/entities/cart/cart.entity';
import { CartItem } from '../../database/entities/cart/cart-item.entity';
import { SellerProduct } from '../../database/entities/product/seller-product.entity';
import { SellerProductSku } from '../../database/entities/product/seller-product-sku.entity';
import { SkuPriceProposal } from '../../database/entities/proposal/sku-price-proposal.entity';
import { ProductActiveStatus } from '../../database/enums/product-active-status.enum';
import { ProductStatus } from '../../database/enums/product-status.enum';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { SkuPriceProposalStatus } from '../../database/enums/sku-price-proposal.enums';
import { effectivePrice } from '../../storefront/storefront-product.service';
import { AddCartItemDto, MAX_LINE_QUANTITY } from '../dtos/cart.dtos';
import { CartView, CartViewService } from './cart-view.service';
import { tidy } from '../../shared/utils/money.util';

const round2 = tidy;

export interface CartResult {
  /** null once the last item was removed (an empty cart is not kept). */
  cart: CartView | null;
  /** Said when the requested quantity had to be reduced. */
  notice: string | null;
}

/**
 * Customer carts. A customer or a guest session has one active cart per seller.
 * Every read is built from live prices and stock (CartViewService); every write
 * re-checks the SKU, so a cart never holds a price the client chose.
 */
@Injectable()
export class UserCartService {
  constructor(
    private readonly db: DatabaseService,
    private readonly views: CartViewService,
  ) {}

  newSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  /** All my active carts, newest activity first. */
  async list(owner: CartOwner) {
    const carts = await this.activeCarts(owner);
    const views = (await Promise.all(carts.map((c) => this.views.build(c.id)))).filter(
      (v): v is CartView => !!v,
    );
    return {
      carts: views,
      summary: {
        cartCount: views.length,
        itemCount: views.reduce((n, v) => n + v.totals.itemCount, 0),
      },
    };
  }

  /** Just the counts, for a header badge. */
  async summary(owner: CartOwner) {
    const carts = await this.activeCarts(owner);
    if (carts.length === 0) return { cartCount: 0, itemCount: 0 };
    const row = await this.db.cartItem
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.quantity), 0)', 'count')
      .where('i.cartId IN (:...ids)', { ids: carts.map((c) => c.id) })
      .getRawOne<{ count: string }>();
    return { cartCount: carts.length, itemCount: Number(row?.count ?? 0) };
  }

  /** My active cart for one seller (null when I have none yet). */
  async forSeller(owner: CartOwner, sellerId: number) {
    const seller = await this.db.seller.findOne({ where: { id: sellerId } });
    if (!seller || seller.status !== SellerStatus.APPROVED || seller.activeStatus !== SellerActiveStatus.ACTIVE) {
      throw new NotFoundException('Seller not found');
    }
    const sellerView = { id: seller.id, name: seller.name, avatarUrl: seller.avatarUrl ?? null };
    if (!owner.userId && !owner.sessionId) return { seller: sellerView, cart: null };
    const cart = await this.db.cart.findOne({
      where: { ...this.ownerWhere(owner), sellerId, isActive: true },
    });
    return { seller: sellerView, cart: cart ? await this.views.build(cart.id) : null };
  }

  async add(owner: CartOwner, dto: AddCartItemDto): Promise<CartResult> {
    this.requireOwner(owner);

    const product = await this.db.sellerProduct.findOne({
      where: { id: dto.sellerProductId },
      relations: { seller: true, skus: true },
    });
    if (!product || !this.buyable(product)) throw new NotFoundException('Product not found');

    if (dto.proposalId !== undefined) return this.addWithProposal(owner, dto, product);

    const sku = this.pickSku(product, dto.sellerProductSkuId);
    if (sku.quantity <= 0) throw new BadRequestException('This item is out of stock');

    const cart = await this.ensureCart(owner, product.sellerId);
    const wanted = dto.quantity ?? 1;

    const notice = await this.db.cart.manager.transaction(async (manager) => {
      await this.lock(manager, cart.id);
      const existing = await manager.findOne(CartItem, {
        where: { cartId: cart.id, sellerProductSkuId: sku.id },
      });
      this.assertNotProposalLine(existing);
      const requested = (existing?.quantity ?? 0) + wanted;
      const quantity = Math.min(requested, MAX_LINE_QUANTITY, sku.quantity);
      await this.saveLine(manager, cart.id, product.id, sku, quantity, existing);
      await this.recalc(manager, cart.id);
      return this.clampNotice(requested, quantity, sku.quantity);
    });
    return { cart: await this.views.build(cart.id), notice };
  }

  /**
   * Put an accepted proposal in the cart. The SKU and quantity are the
   * proposal's; a line already holding that SKU becomes the proposal line.
   */
  private async addWithProposal(owner: CartOwner, dto: AddCartItemDto, product: SellerProduct): Promise<CartResult> {
    if (!owner.userId) throw new BadRequestException('Sign in to buy at a price proposal');
    const proposal = await this.db.cart.manager.findOne(SkuPriceProposal, {
      where: { id: dto.proposalId as number, userId: owner.userId },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== SkuPriceProposalStatus.ACCEPTED) {
      throw new BadRequestException(`This proposal is ${proposal.status}, so its price cannot be used`);
    }
    if (proposal.sellerProductId !== product.id) throw new BadRequestException('That proposal is for a different product');
    if (dto.sellerProductSkuId !== undefined && dto.sellerProductSkuId !== proposal.sellerProductSkuId) {
      throw new BadRequestException('That proposal is for a different variant');
    }
    if (dto.quantity !== undefined && dto.quantity !== proposal.quantity) {
      throw new BadRequestException(`The quantity is fixed at ${proposal.quantity} by the proposal`);
    }
    const sku = (product.skus ?? []).find((s) => s.id === proposal.sellerProductSkuId && s.isActive);
    if (!sku) throw new BadRequestException('That variant is not available for this product');
    if (sku.quantity <= 0) throw new BadRequestException('This item is out of stock');
    if (proposal.quantity > sku.quantity) {
      throw new BadRequestException(`Only ${sku.quantity} in stock, but the proposal is for ${proposal.quantity}`);
    }

    const cart = await this.ensureCart(owner, product.sellerId);
    await this.db.cart.manager.transaction(async (manager) => {
      await this.lock(manager, cart.id);
      // Cart first, proposal second (as checkout does): the proposal may have been closed meanwhile.
      const [now]: { status: string }[] = await manager.query(
        `SELECT status FROM sku_price_proposal WHERE id = $1 FOR SHARE`,
        [proposal.id],
      );
      if (now?.status !== SkuPriceProposalStatus.ACCEPTED) {
        throw new BadRequestException('This proposal is no longer accepted, so its price cannot be used');
      }
      const existing = await manager.findOne(CartItem, {
        where: { cartId: cart.id, sellerProductSkuId: sku.id },
      });
      await this.saveLine(manager, cart.id, product.id, sku, proposal.quantity, existing, proposal);
      await this.recalc(manager, cart.id);
    });
    return { cart: await this.views.build(cart.id), notice: null };
  }

  /** A line bought at a proposal price keeps its quantity: remove it to buy a different amount. */
  private assertNotProposalLine(item: CartItem | null) {
    if (item?.proposalId && item.unitProposalPrice != null) {
      throw new BadRequestException(
        'This item is in your cart at your proposal price, so its quantity is fixed. Remove it to change the quantity.',
      );
    }
  }

  async updateQuantity(
    owner: CartOwner,
    cartId: number,
    itemId: number,
    requested: number,
  ): Promise<CartResult> {
    this.requireOwner(owner);
    const cart = await this.ownedCart(owner, cartId);
    const item = await this.db.cartItem.findOne({
      where: { id: itemId, cartId: cart.id },
      relations: { product: { seller: true }, sku: true },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (!item.product || !this.buyable(item.product) || !item.sku?.isActive) {
      throw new BadRequestException('This item is no longer available. Remove it from your cart.');
    }
    if (item.sku.quantity <= 0) throw new BadRequestException('This item is out of stock');
    this.assertNotProposalLine(item);

    const sku = item.sku;
    const quantity = Math.min(requested, MAX_LINE_QUANTITY, sku.quantity);
    await this.db.cart.manager.transaction(async (manager) => {
      await this.lock(manager, cart.id);
      await this.saveLine(manager, cart.id, item.sellerProductId, sku, quantity, item);
      await this.recalc(manager, cart.id);
    });
    return {
      cart: await this.views.build(cart.id),
      notice: this.clampNotice(requested, quantity, sku.quantity),
    };
  }

  async removeItem(owner: CartOwner, cartId: number, itemId: number): Promise<CartResult> {
    this.requireOwner(owner);
    const cart = await this.ownedCart(owner, cartId);
    const item = await this.db.cartItem.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('Cart item not found');

    const remaining = await this.db.cart.manager.transaction(async (manager) => {
      await this.lock(manager, cart.id);
      await manager.delete(CartItem, { id: item.id });
      const left = await manager.count(CartItem, { where: { cartId: cart.id } });
      if (left === 0) await manager.delete(Cart, { id: cart.id });
      else await this.recalc(manager, cart.id);
      return left;
    });
    return { cart: remaining === 0 ? null : await this.views.build(cart.id), notice: null };
  }

  /** Empty the cart: it is deleted, not kept (only ordered carts stay, as inactive). */
  async clear(owner: CartOwner, cartId: number): Promise<void> {
    this.requireOwner(owner);
    const cart = await this.ownedCart(owner, cartId);
    await this.db.cart.delete({ id: cart.id });
  }

  /**
   * Fold the guest session's carts into the customer's own, seller by seller.
   * Quantities add up and are capped at stock; unavailable items are dropped.
   */
  async merge(userId: number, sessionId: string) {
    const guestCarts = await this.db.cart.find({
      where: { sessionId, isActive: true },
      relations: { items: true },
    });
    for (const guest of guestCarts) {
      const mine = await this.ensureCart({ userId, sessionId: null }, guest.sellerId);
      await this.db.cart.manager.transaction(async (manager) => {
        await this.lock(manager, mine.id);
        for (const line of guest.items ?? []) {
          const product = await manager.findOne(SellerProduct, {
            where: { id: line.sellerProductId },
            relations: { seller: true },
          });
          const sku = await manager.findOne(SellerProductSku, {
            where: { id: line.sellerProductSkuId },
          });
          if (!product || !this.buyable(product) || !sku || !sku.isActive || sku.quantity <= 0) continue;
          if (sku.sellerProductId !== product.id) continue;
          const existing = await manager.findOne(CartItem, {
            where: { cartId: mine.id, sellerProductSkuId: sku.id },
          });
          if (existing?.proposalId && existing.unitProposalPrice != null) continue;
          const quantity = Math.min(
            (existing?.quantity ?? 0) + line.quantity,
            MAX_LINE_QUANTITY,
            sku.quantity,
          );
          await this.saveLine(manager, mine.id, product.id, sku, quantity, existing);
        }
        await this.recalc(manager, mine.id);
        await manager.delete(Cart, { id: guest.id });
        // a merge that brought nothing over must not leave an empty cart behind
        if ((await manager.count(CartItem, { where: { cartId: mine.id } })) === 0) {
          await manager.delete(Cart, { id: mine.id });
        }
      });
    }
    // Orders placed as a guest on this browser now belong to the account.
    await this.db.order.update(
      { guestSessionId: sessionId },
      { userId, guestSessionId: null },
    );
    return this.list({ userId, sessionId: null });
  }

  // ------------------------------------------------------------------ helpers

  private requireOwner(owner: CartOwner) {
    if (!owner.userId && !owner.sessionId) {
      throw new BadRequestException('Guests must send the x-cart-session header to use a cart');
    }
  }

  private ownerWhere(owner: CartOwner) {
    return owner.userId ? { userId: owner.userId } : { sessionId: owner.sessionId as string };
  }

  private async activeCarts(owner: CartOwner): Promise<Cart[]> {
    if (!owner.userId && !owner.sessionId) return [];
    return this.db.cart.find({
      where: { ...this.ownerWhere(owner), isActive: true },
      order: { updatedAt: 'DESC', id: 'DESC' },
    });
  }

  private async ownedCart(owner: CartOwner, cartId: number): Promise<Cart> {
    const cart = await this.db.cart.findOne({
      where: { id: cartId, ...this.ownerWhere(owner), isActive: true },
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  /** The owner's active cart for this seller, created on first use. */
  private async ensureCart(owner: CartOwner, sellerId: number): Promise<Cart> {
    const where = { ...this.ownerWhere(owner), sellerId, isActive: true };
    const found = await this.db.cart.findOne({ where });
    if (found) return found;
    try {
      return await this.db.cart.save(this.db.cart.create({ ...where, totalPrice: 0, totalDiscountedPrice: 0 }));
    } catch (error) {
      // a parallel request created it first (unique index): use that one
      if (error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === '23505') {
        const again = await this.db.cart.findOne({ where });
        if (again) return again;
      }
      throw error;
    }
  }

  private lock(manager: EntityManager, cartId: number) {
    return manager
      .createQueryBuilder(Cart, 'c')
      .setLock('pessimistic_write')
      .where('c.id = :id', { id: cartId })
      .getOne();
  }

  private buyable(product: SellerProduct): boolean {
    const seller = product.seller;
    return (
      !product.deletedAt &&
      product.status === ProductStatus.APPROVED &&
      product.activeStatus === ProductActiveStatus.ACTIVE &&
      !!seller &&
      !seller.deletedAt &&
      seller.status === SellerStatus.APPROVED &&
      seller.activeStatus === SellerActiveStatus.ACTIVE
    );
  }

  private pickSku(product: SellerProduct, skuId?: number): SellerProductSku {
    const live = (product.skus ?? []).filter((s) => s.isActive);
    if (skuId !== undefined) {
      const sku = live.find((s) => s.id === skuId);
      if (!sku) throw new BadRequestException('That variant is not available for this product');
      return sku;
    }
    if (live.length === 0) throw new BadRequestException('This product cannot be bought right now');
    const inStock = live.filter((s) => s.quantity > 0);
    const pool = inStock.length ? inStock : live;
    return (
      pool.find((s) => s.isDefault) ??
      pool.reduce((best, s) => (effectivePrice(s) < effectivePrice(best) ? s : best))
    );
  }

  private async saveLine(
    manager: EntityManager,
    cartId: number,
    productId: number,
    sku: SellerProductSku,
    quantity: number,
    existing: CartItem | null,
    proposal: SkuPriceProposal | null = null,
  ) {
    const unitPrice = Number(sku.price);
    const payable = effectivePrice(sku);
    const values = {
      quantity,
      unitPrice,
      // the SKU's own price; a proposal line is payable at the proposal price below
      unitDiscountedPrice: payable,
      totalPrice: round2(unitPrice * quantity),
      totalDiscountedPrice: round2(payable * quantity),
      proposalId: proposal?.id ?? null,
      unitProposalPrice: proposal ? Number(proposal.price) : null,
      totalProposalPrice: proposal ? round2(Number(proposal.price) * quantity) : null,
    };
    if (existing) await manager.update(CartItem, { id: existing.id }, values);
    else {
      await manager.insert(CartItem, {
        cartId,
        sellerProductId: productId,
        sellerProductSkuId: sku.id,
        ...values,
      });
    }
  }

  /** Keep the cart's stored totals in step with its lines (the admin list reads them). */
  private async recalc(manager: EntityManager, cartId: number) {
    const row = await manager
      .createQueryBuilder(CartItem, 'i')
      .select('COALESCE(SUM(i.totalPrice), 0)', 'list')
      .addSelect('COALESCE(SUM(COALESCE(i.totalProposalPrice, i.totalDiscountedPrice)), 0)', 'payable')
      .where('i.cartId = :cartId', { cartId })
      .getRawOne<{ list: string; payable: string }>();
    await manager.update(Cart, { id: cartId }, {
      totalPrice: Number(row?.list ?? 0),
      totalDiscountedPrice: Number(row?.payable ?? 0),
    });
  }

  private clampNotice(requested: number, applied: number, stock: number): string | null {
    if (applied >= requested) return null;
    if (applied === stock) return `Only ${stock} available, so your cart has ${applied}.`;
    return `You can buy up to ${MAX_LINE_QUANTITY} of one item, so your cart has ${applied}.`;
  }
}
