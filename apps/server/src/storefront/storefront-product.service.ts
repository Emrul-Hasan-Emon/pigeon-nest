import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { DatabaseService } from '../database/database.service';
import { SellerProduct } from '../database/entities/product/seller-product.entity';
import { SellerProductSku } from '../database/entities/product/seller-product-sku.entity';
import { ProductActiveStatus } from '../database/enums/product-active-status.enum';
import { ProductStatus } from '../database/enums/product-status.enum';
import { SellerActiveStatus } from '../database/enums/seller-active-status.enum';
import { SellerStatus } from '../database/enums/seller-status.enum';
import { likeContains } from '../shared/utils/like.util';
import { PageRequest } from '../shared/utils/page-paginate.util';

export enum ProductSort {
  NEWEST = 'newest',
  PRICE_ASC = 'priceAsc',
  PRICE_DESC = 'priceDesc',
  NAME_ASC = 'nameAsc',
}

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  includeSubcategories?: boolean;
  collectionId?: number;
  sellerId?: number;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number | null;
  discountedPrice: number | null;
  seller: { id: number; name: string } | null;
  category: { id: number; name: string; slug: string } | null;
}

// What the customer pays for one SKU right now (live discount, else list price).
const effective = (k: string) =>
  `CASE WHEN ${k}."discountedPrice" IS NOT NULL
        AND (${k}."discountedPriceStartDate" IS NULL OR ${k}."discountedPriceStartDate" <= now())
        AND (${k}."discountedPriceEndDate" IS NULL OR ${k}."discountedPriceEndDate" > now())
        THEN ${k}."discountedPrice" ELSE ${k}.price END`;

const LIVE_SKU = (k: string) =>
  `${k}."sellerProductId" = p.id AND ${k}."isActive" = true AND ${k}."deletedAt" IS NULL`;

// The price shown on a card: the default SKU if it is live, else the cheapest live SKU.
export const DISPLAY_PRICE_SQL = `COALESCE(
  (SELECT ${effective('k1')} FROM seller_product_sku k1 WHERE ${LIVE_SKU('k1')} AND k1."isDefault" = true ORDER BY k1.id LIMIT 1),
  (SELECT MIN(${effective('k2')}) FROM seller_product_sku k2 WHERE ${LIVE_SKU('k2')}))`;

export function isDiscountLive(sku: SellerProductSku, now = new Date()) {
  return (
    sku.discountedPrice !== null &&
    sku.discountedPrice !== undefined &&
    (!sku.discountedPriceStartDate || sku.discountedPriceStartDate <= now) &&
    (!sku.discountedPriceEndDate || sku.discountedPriceEndDate > now)
  );
}

export function effectivePrice(sku: SellerProductSku, now = new Date()) {
  return isDiscountLive(sku, now)
    ? Number(sku.discountedPrice)
    : Number(sku.price);
}

/** The single place that decides what a customer may see, and how a product card looks. */
@Injectable()
export class StorefrontProductService {
  constructor(private readonly db: DatabaseService) {}

  /** Products the storefront may show: approved, active, live seller, active SKU. */
  eligibleProducts(): SelectQueryBuilder<SellerProduct> {
    return this.db.sellerProduct
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.seller', 's')
      .leftJoinAndSelect('p.category', 'cat')
      .where('p.status = :ps', { ps: ProductStatus.APPROVED })
      .andWhere('p.activeStatus = :pa', { pa: ProductActiveStatus.ACTIVE })
      .andWhere('s.status = :ss', { ss: SellerStatus.APPROVED })
      .andWhere('s.activeStatus = :sa', { sa: SellerActiveStatus.ACTIVE })
      .andWhere('s.deletedAt IS NULL')
      .andWhere(
        `EXISTS (SELECT 1 FROM seller_product_sku k WHERE k."sellerProductId" = p.id AND k."isActive" = true AND k."deletedAt" IS NULL)`,
      );
  }

  /** A category id plus every active descendant. */
  async categoryTreeIds(categoryId: number): Promise<number[]> {
    const rows: { id: number }[] = await this.db.category.query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM category WHERE id = $1
         UNION ALL
         SELECT c.id FROM category c JOIN tree t ON c."parentId" = t.id
         WHERE c."deletedAt" IS NULL AND c."isActive" = true
       ) SELECT id FROM tree`,
      [categoryId],
    );
    return rows.map((r) => Number(r.id));
  }

  /** Filtered, sorted, one page of cards plus the total match count. */
  async search(filters: ProductFilters, page: PageRequest) {
    const qb = this.eligibleProducts();

    if (filters.search) {
      qb.andWhere('(p.name ILIKE :q OR s.name ILIKE :q)', {
        q: likeContains(filters.search),
      });
    }
    if (filters.categoryId !== undefined) {
      const ids =
        filters.includeSubcategories === false
          ? [filters.categoryId]
          : await this.categoryTreeIds(filters.categoryId);
      // an unknown category has no tree rows: nothing can match
      if (ids.length === 0) return { items: [] as ProductCard[], total: 0 };
      qb.andWhere('p.categoryId IN (:...categoryIds)', { categoryIds: ids });
    }
    if (filters.collectionId !== undefined) {
      qb.andWhere('p.collectionId = :collectionId', {
        collectionId: filters.collectionId,
      });
    }
    if (filters.sellerId !== undefined) {
      qb.andWhere('p.sellerId = :sellerId', { sellerId: filters.sellerId });
    }
    if (filters.featured) {
      qb.andWhere('p.isFeatured = true');
    }
    if (filters.minPrice !== undefined) {
      qb.andWhere(`${DISPLAY_PRICE_SQL} >= :minPrice`, {
        minPrice: filters.minPrice,
      });
    }
    if (filters.maxPrice !== undefined) {
      qb.andWhere(`${DISPLAY_PRICE_SQL} <= :maxPrice`, {
        maxPrice: filters.maxPrice,
      });
    }

    const total = await qb.getCount();

    // Order first by id only, using raw selects: ordering a joined query by an
    // expression and paging it breaks TypeORM's own pagination, so page the
    // ids and load the entities after.
    const idQuery = qb.clone().select('p.id', 'id');
    switch (filters.sort) {
      case ProductSort.PRICE_ASC:
        idQuery.addSelect(DISPLAY_PRICE_SQL, 'dp').orderBy('dp', 'ASC');
        break;
      case ProductSort.PRICE_DESC:
        idQuery.addSelect(DISPLAY_PRICE_SQL, 'dp').orderBy('dp', 'DESC');
        break;
      case ProductSort.NAME_ASC:
        idQuery.orderBy('LOWER(p.name)', 'ASC');
        break;
      default:
        break;
    }
    idQuery.addOrderBy('p.id', 'DESC').offset(page.offset).limit(page.pageSize);
    const ids = (await idQuery.getRawMany<{ id: number }>()).map((r) =>
      Number(r.id),
    );
    if (ids.length === 0) return { items: [] as ProductCard[], total };

    const products = await this.eligibleProducts()
      .andWhere('p.id IN (:...ids)', { ids })
      .getMany();
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((p): p is SellerProduct => !!p);
    return { items: await this.toCards(ordered), total };
  }

  /** How many storefront-visible products each of these sellers has. */
  async countBySeller(sellerIds: number[]): Promise<Map<number, number>> {
    if (sellerIds.length === 0) return new Map();
    const rows = await this.eligibleProducts()
      .select('p.sellerId', 'sellerId')
      .addSelect('COUNT(*)', 'count')
      .andWhere('p.sellerId IN (:...sellerIds)', { sellerIds })
      .groupBy('p.sellerId')
      .getRawMany<{ sellerId: number; count: string }>();
    return new Map(rows.map((r) => [Number(r.sellerId), Number(r.count)]));
  }

  async toCards(products: SellerProduct[]): Promise<ProductCard[]> {
    if (products.length === 0) return [];
    const skus = await this.db.sellerProductSku
      .createQueryBuilder('k')
      .where('k.sellerProductId IN (:...ids)', {
        ids: products.map((p) => p.id),
      })
      .andWhere('k.isActive = true')
      .getMany();
    const now = new Date();

    return products.map((p) => {
      const own = skus.filter((k) => k.sellerProductId === p.id);
      const sku =
        own.find((k) => k.isDefault) ??
        [...own].sort((a, b) => effectivePrice(a, now) - effectivePrice(b, now))[0];
      const live = !!sku && isDiscountLive(sku, now);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        thumbnailUrl: p.thumbnailUrl ?? null,
        price: sku ? Number(sku.price) : null,
        discountedPrice: live ? Number(sku.discountedPrice) : null,
        seller: p.seller ? { id: p.seller.id, name: p.seller.name } : null,
        category: p.category
          ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
          : null,
      };
    });
  }
}
