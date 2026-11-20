import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Cart } from '../../database/entities/cart/cart.entity';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { CartOwnerKind, CartState, ListCartQueryDto } from '../dtos/admin-cart-query.dto';
import { CartViewService } from './cart-view.service';

// A date-only value for an upper bound means "through the end of that day".
function upperBound(value: string): Date {
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date;
}

@Injectable()
export class AdminCartService {
  constructor(
    private readonly db: DatabaseService,
    private readonly views: CartViewService,
  ) {}

  async list(query: ListCartQueryDto, pagination: CursorPagination) {
    if (query.minTotal !== undefined && query.maxTotal !== undefined && query.minTotal > query.maxTotal) {
      throw new BadRequestException('minTotal cannot be greater than maxTotal');
    }
    for (const [from, to] of [
      [query.createdFrom, query.createdTo],
      [query.updatedFrom, query.updatedTo],
    ] as const) {
      if (from && to && new Date(from) > upperBound(to)) {
        throw new BadRequestException('A "from" date cannot be after its "to" date');
      }
    }

    const state = query.state ?? CartState.ACTIVE;
    const qb = this.db.cart
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .leftJoinAndSelect('c.seller', 's')
      .where('c.isActive = :active', { active: state === CartState.ACTIVE })
      .orderBy('c.id', 'DESC')
      .take(pagination.limit);
    if (pagination.cursor > 0) qb.andWhere('c.id < :cursor', { cursor: pagination.cursor });

    if (query.sellerId !== undefined) qb.andWhere('c.sellerId = :sellerId', { sellerId: query.sellerId });
    if (query.sellerSearch) qb.andWhere('s.name ILIKE :ss', { ss: likeContains(query.sellerSearch) });
    if (query.userId !== undefined) qb.andWhere('c.userId = :userId', { userId: query.userId });
    if (query.owner === CartOwnerKind.CUSTOMER) qb.andWhere('c.userId IS NOT NULL');
    if (query.owner === CartOwnerKind.GUEST) qb.andWhere('c.userId IS NULL');
    if (query.customerSearch) {
      qb.andWhere('(u.name ILIKE :cs OR u.email ILIKE :cs OR u.phone ILIKE :cs)', {
        cs: likeContains(query.customerSearch),
      });
    }
    if (query.orderNumber) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "order" o WHERE o.id = c."orderId" AND o."orderNumber" ILIKE :on)`,
        { on: likeContains(query.orderNumber) },
      );
    }
    if (query.hasItems !== undefined) {
      const exists = `EXISTS (SELECT 1 FROM cart_item i WHERE i."cartId" = c.id AND i."deletedAt" IS NULL)`;
      qb.andWhere(query.hasItems ? exists : `NOT ${exists}`);
    }
    if (query.minTotal !== undefined) qb.andWhere('c.totalDiscountedPrice >= :minT', { minT: query.minTotal });
    if (query.maxTotal !== undefined) qb.andWhere('c.totalDiscountedPrice <= :maxT', { maxT: query.maxTotal });
    if (query.createdFrom) qb.andWhere('c.createdAt >= :cf', { cf: new Date(query.createdFrom) });
    if (query.createdTo) qb.andWhere('c.createdAt <= :ct', { ct: upperBound(query.createdTo) });
    if (query.updatedFrom) qb.andWhere('c.updatedAt >= :uf', { uf: new Date(query.updatedFrom) });
    if (query.updatedTo) qb.andWhere('c.updatedAt <= :ut', { ut: upperBound(query.updatedTo) });

    const page = getCursorPaginateData(await qb.getMany(), pagination.limit);
    const ids = page.results.map((c) => c.id);
    const counts = await this.itemCounts(ids);
    const orders = await this.orderInfo(page.results.map((c) => c.orderId).filter((v): v is number => !!v));

    return {
      ...page,
      results: page.results.map((c) => ({
        id: c.id,
        isActive: c.isActive,
        owner: this.owner(c),
        seller: { id: c.sellerId, name: c.seller?.name ?? '' },
        lineCount: counts.get(c.id)?.lines ?? 0,
        itemCount: counts.get(c.id)?.items ?? 0,
        listTotal: Number(c.totalPrice),
        payableTotal: Number(c.totalDiscountedPrice),
        order: c.orderId ? (orders.get(c.orderId) ?? { id: c.orderId, orderNumber: null, status: null }) : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  async details(id: number) {
    const cart = await this.views.load(id);
    if (!cart) throw new NotFoundException('Cart not found');
    const live = this.views.fromCart(cart);
    const orders = cart.orderId ? await this.orderInfo([cart.orderId]) : new Map();

    return {
      id: cart.id,
      isActive: cart.isActive,
      owner: this.owner(cart, true),
      seller: { id: cart.sellerId, name: cart.seller?.name ?? '', avatarUrl: cart.seller?.avatarUrl ?? null },
      order: cart.orderId ? (orders.get(cart.orderId) ?? { id: cart.orderId, orderNumber: null, status: null }) : null,
      // live: current prices and stock. snapshot: what each line held when the cart was last changed
      // (for an ordered cart, the moment it was checked out).
      mode: cart.isActive ? 'live' : 'snapshot',
      lines: cart.isActive
        ? live.lines
        : (cart.items ?? []).map((item) => ({
            id: item.id,
            product: item.product
              ? { id: item.product.id, name: item.product.name, slug: item.product.slug, thumbnailUrl: item.product.thumbnailUrl ?? null }
              : null,
            sku: item.sku ? { id: item.sku.id, code: item.sku.sku, imageUrl: item.sku.imageUrl ?? null } : null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            unitPayable: Number(item.unitDiscountedPrice ?? item.unitPrice),
            linePayable: Number(item.totalDiscountedPrice ?? item.totalPrice),
          })),
      totals: cart.isActive
        ? live.totals
        : {
            itemCount: (cart.items ?? []).reduce((n, i) => n + i.quantity, 0),
            listTotal: Number(cart.totalPrice),
            payableTotal: Number(cart.totalDiscountedPrice),
            savings: Number(cart.totalPrice) - Number(cart.totalDiscountedPrice),
          },
      canCheckout: cart.isActive ? live.canCheckout : null,
      issues: cart.isActive ? live.issues : [],
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  private owner(cart: Cart, full = false) {
    if (cart.userId && cart.user) {
      return {
        type: 'customer' as const,
        user: { id: cart.user.id, name: cart.user.name, email: cart.user.email, phone: cart.user.phone },
        sessionId: null,
      };
    }
    return {
      type: 'guest' as const,
      user: null,
      // the full id only on the detail page, so lists never expose a usable session
      sessionId: cart.sessionId ? (full ? cart.sessionId : `${cart.sessionId.slice(0, 6)}…`) : null,
    };
  }

  private async itemCounts(cartIds: number[]) {
    const map = new Map<number, { lines: number; items: number }>();
    if (cartIds.length === 0) return map;
    const rows = await this.db.cartItem
      .createQueryBuilder('i')
      .select('i.cartId', 'cartId')
      .addSelect('COUNT(*)', 'lines')
      .addSelect('COALESCE(SUM(i.quantity), 0)', 'items')
      .where('i.cartId IN (:...cartIds)', { cartIds })
      .groupBy('i.cartId')
      .getRawMany<{ cartId: number; lines: string; items: string }>();
    for (const r of rows) map.set(Number(r.cartId), { lines: Number(r.lines), items: Number(r.items) });
    return map;
  }

  private async orderInfo(orderIds: number[]) {
    const map = new Map<number, { id: number; orderNumber: string | null; status: string | null }>();
    if (orderIds.length === 0) return map;
    const rows = await this.db.order
      .createQueryBuilder('o')
      .select(['o.id', 'o.orderNumber', 'o.status'])
      .where('o.id IN (:...orderIds)', { orderIds })
      .getMany();
    for (const o of rows) map.set(o.id, { id: o.id, orderNumber: o.orderNumber, status: o.status });
    return map;
  }
}
