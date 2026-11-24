import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/person/user.entity';
import { Wishlist } from '../../database/entities/wishlist/wishlist.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ProductActiveStatus } from '../../database/enums/product-active-status.enum';
import { ProductStatus } from '../../database/enums/product-status.enum';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { tidy } from '../../shared/utils/money.util';
import { DISPLAY_PRICE_SQL, LIVE_SKU, StorefrontProductService } from '../../storefront/storefront-product.service';
import { ListWishlistQueryDto } from '../dtos/wishlist.dtos';
import { isShopClosed, sellerOpenSql } from '../../shared/utils/shop-break.util';

export const WISHLIST_LIMIT = 200;

export type Availability = 'available' | 'out_of_stock' | 'unavailable' | 'removed';

// Live product facts for one wishlist row. Joins use plain tables so a deleted
// product or seller still shows up (greyed out) instead of vanishing.
export const LIVE_COLUMNS = `
  p.name AS "name", p.slug AS "slug", p."thumbnailUrl" AS "thumbnailUrl",
  p."wishlistCount" AS "wishlistCount",
  p."deletedAt" AS "pDeleted", p.status AS "pStatus", p."activeStatus" AS "pActive",
  s.id AS "sellerId", s.name AS "sellerName",
  s.status AS "sStatus", s."activeStatus" AS "sActive", s."deletedAt" AS "sDeleted",
  s."isEnabledForSell" AS "sSelling", s."breakStartsOn" AS "sBreakStart", s."breakEndsOn" AS "sBreakEnd",
  ${DISPLAY_PRICE_SQL} AS "price",
  (SELECT COALESCE(SUM(k.quantity), 0)::int FROM seller_product_sku k WHERE ${LIVE_SKU('k')}) AS "stock",
  (SELECT COUNT(*)::int FROM seller_product_sku k WHERE ${LIVE_SKU('k')}) AS "skuCount"`;

export interface LiveRow {
  pDeleted: Date | null;
  pStatus: string | null;
  pActive: string | null;
  sStatus: string | null;
  sActive: string | null;
  sDeleted: Date | null;
  sSelling: boolean | null;
  sBreakStart: string | Date | null;
  sBreakEnd: string | Date | null;
  price: number | string | null;
  stock: number | null;
  skuCount: number | null;
}

export interface WishlistRow extends LiveRow {
  id: number;
  [key: string]: any;
}

export function availabilityOf(r: LiveRow): { availability: Availability; reason: string | null } {
  if (r.pStatus === null || r.pDeleted) return { availability: 'removed', reason: 'This product was removed' };
  const live =
    r.pStatus === ProductStatus.APPROVED &&
    r.pActive === ProductActiveStatus.ACTIVE &&
    r.sStatus === SellerStatus.APPROVED &&
    r.sActive === SellerActiveStatus.ACTIVE &&
    !isShopClosed({ isEnabledForSell: r.sSelling !== false, breakStartsOn: r.sBreakStart, breakEndsOn: r.sBreakEnd }) &&
    !r.sDeleted &&
    (r.skuCount ?? 0) > 0;
  if (!live) return { availability: 'unavailable', reason: 'This product is not available right now' };
  if ((r.stock ?? 0) <= 0) return { availability: 'out_of_stock', reason: 'Out of stock' };
  return { availability: 'available', reason: null };
}

/** The same rule in SQL, for the inStock filter. */
const PURCHASABLE = `(p.id IS NOT NULL AND p."deletedAt" IS NULL AND p.status = $PS AND p."activeStatus" = $PA
  AND s.status = $SS AND s."activeStatus" = $SA AND s."deletedAt" IS NULL AND ${sellerOpenSql('s')}
  AND (SELECT COALESCE(SUM(k.quantity), 0) FROM seller_product_sku k WHERE ${LIVE_SKU('k')}) > 0)`;

export function priceChange(now: number | null, saved: number) {
  if (now === null) return null;
  const diff = tidy(now - saved);
  return { direction: diff < 0 ? 'dropped' : diff > 0 ? 'rose' : 'same', amount: Math.abs(diff) };
}

/** A customer's own wishlist. */
@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(Wishlist) private readonly repo: Repository<Wishlist>,
    private readonly storefront: StorefrontProductService,
  ) {}

  /** Ids only: cards use it to colour their hearts with one call. */
  async ids(user: User) {
    const rows: { productId: number }[] = await this.repo.query(
      `SELECT "sellerProductId" AS "productId" FROM wishlist WHERE "userId" = $1 ORDER BY wishlist.id DESC`,
      [user.id],
    );
    return { productIds: rows.map((r) => Number(r.productId)), limit: WISHLIST_LIMIT };
  }

  async list(user: User, query: ListWishlistQueryDto, pagination: CursorPagination) {
    const params: unknown[] = [user.id];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where: string[] = [`w."userId" = $1`];
    if (query.inStock !== undefined) {
      const rule = PURCHASABLE.replace('$PS', add(ProductStatus.APPROVED))
        .replace('$PA', add(ProductActiveStatus.ACTIVE))
        .replace('$SS', add(SellerStatus.APPROVED))
        .replace('$SA', add(SellerActiveStatus.ACTIVE));
      where.push(query.inStock ? rule : `NOT ${rule}`);
    }
    if (query.minPrice !== undefined) where.push(`${DISPLAY_PRICE_SQL} >= ${add(query.minPrice)}`);
    if (query.maxPrice !== undefined) where.push(`${DISPLAY_PRICE_SQL} <= ${add(query.maxPrice)}`);
    if (query.sellerId !== undefined) where.push(`p."sellerId" = ${add(query.sellerId)}`);
    if (query.search) where.push(`p.name ILIKE ${add(likeContains(query.search))}`);
    if (pagination.cursor > 0) where.push(`w.id < ${add(pagination.cursor)}`);

    const rows: WishlistRow[] = await this.repo.query(
      `SELECT w.id, w."sellerProductId" AS "productId", w."priceWhenSaved", w."createdAt" AS "savedAt", ${LIVE_COLUMNS}
         FROM wishlist w
         LEFT JOIN seller_product p ON p.id = w."sellerProductId"
         LEFT JOIN seller s ON s.id = p."sellerId"
        WHERE ${where.join(' AND ')}
        ORDER BY w.id DESC
        LIMIT ${add(pagination.limit)}`,
      params,
    );
    const page = getCursorPaginateData<WishlistRow>(rows, pagination.limit);
    return {
      ...page,
      results: page.results.map((r) => {
        const price = r.price === null ? null : Number(r.price);
        const saved = Number(r.priceWhenSaved);
        return {
          id: r.id,
          productId: r.productId,
          savedAt: r.savedAt,
          name: r.name,
          slug: r.slug,
          thumbnailUrl: r.thumbnailUrl,
          seller: r.sellerId ? { id: r.sellerId, name: r.sellerName } : null,
          price,
          priceWhenSaved: saved,
          priceChange: priceChange(price, saved),
          stock: r.stock ?? 0,
          skuCount: r.skuCount ?? 0,
          ...availabilityOf(r),
        };
      }),
    };
  }

  /** Save a product. Saving twice is fine and changes nothing. */
  async add(user: User, productId: number) {
    const product = await this.storefront.eligibleProducts().andWhere('p.id = :id', { id: productId }).getOne();
    if (!product) throw new NotFoundException('Product not found');
    const [{ price }] = await this.repo.query(`SELECT ${DISPLAY_PRICE_SQL} AS price FROM seller_product p WHERE p.id = $1`, [productId]);

    return this.repo.manager.transaction(async (m) => {
      // One customer's adds queue up here, so the 200 cap cannot be raced past.
      await m.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [user.id]);
      const [{ n }] = await m.query(`SELECT COUNT(*)::int AS n FROM wishlist WHERE "userId" = $1`, [user.id]);
      const exists = await m.query(`SELECT 1 FROM wishlist WHERE "userId" = $1 AND "sellerProductId" = $2`, [user.id, productId]);
      if (exists.length > 0) return { productId, saved: true, added: false, total: n };
      if (n >= WISHLIST_LIMIT) {
        throw new BadRequestException(`Your wishlist is full (${WISHLIST_LIMIT} products). Remove one to save another.`);
      }
      await m.query(
        `INSERT INTO wishlist ("userId", "sellerProductId", "priceWhenSaved", "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
         VALUES ($1, $2, $3, $1, $4, $5, $1, $4, $5)`,
        [user.id, productId, price === null ? 0 : Number(price), AuthUserType.USER, user.name],
      );
      await m.query(`UPDATE seller_product SET "wishlistCount" = "wishlistCount" + 1 WHERE id = $1`, [productId]);
      return { productId, saved: true, added: true, total: n + 1 };
    });
  }

  /** Remove a product. Works on hidden or deleted products too; removing one that is not saved changes nothing. */
  async remove(user: User, productId: number) {
    return this.repo.manager.transaction(async (m) => {
      await m.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [user.id]);
      // A DELETE ... RETURNING answers [rows, rowCount] through the driver.
      const [gone]: [{ id: number }[], number] = await m.query(
        `DELETE FROM wishlist WHERE "userId" = $1 AND "sellerProductId" = $2 RETURNING id`,
        [user.id, productId],
      );
      if (gone.length > 0) {
        await m.query(`UPDATE seller_product SET "wishlistCount" = "wishlistCount" - 1 WHERE id = $1`, [productId]);
      }
      const [{ n }] = await m.query(`SELECT COUNT(*)::int AS n FROM wishlist WHERE "userId" = $1`, [user.id]);
      return { productId, saved: false, removed: gone.length > 0, total: n };
    });
  }
}
