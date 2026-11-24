import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/person/user.entity';
import { Wishlist } from '../../database/entities/wishlist/wishlist.entity';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { AdminListWishlistQueryDto } from '../dtos/wishlist.dtos';
import { availabilityOf, LIVE_COLUMNS, priceChange, WishlistRow } from './wishlist.service';

/** Read-only views for admins (who saved what) and sellers (how often). */
@Injectable()
export class WishlistInsightsService {
  constructor(
    @InjectRepository(Wishlist) private readonly repo: Repository<Wishlist>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Every saved row with customer, seller and product details. */
  async adminList(query: AdminListWishlistQueryDto, pagination: CursorPagination) {
    const params: unknown[] = [];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where: string[] = ['TRUE'];
    if (query.userId !== undefined) where.push(`w."userId" = ${add(query.userId)}`);
    if (query.productId !== undefined) where.push(`w."sellerProductId" = ${add(query.productId)}`);
    if (query.sellerId !== undefined) where.push(`p."sellerId" = ${add(query.sellerId)}`);
    if (query.search) where.push(`p.name ILIKE ${add(likeContains(query.search))}`);
    if (query.userSearch) {
      const q = add(likeContains(query.userSearch));
      where.push(`(u.name ILIKE ${q} OR u.email ILIKE ${q} OR u.phone ILIKE ${q})`);
    }
    if (query.sellerSearch) {
      const q = add(likeContains(query.sellerSearch));
      where.push(`(s.name ILIKE ${q} OR s.email ILIKE ${q} OR s.phone ILIKE ${q})`);
    }
    if (pagination.cursor > 0) where.push(`w.id < ${add(pagination.cursor)}`);

    const rows: WishlistRow[] = await this.repo.query(
      `SELECT w.id, w."sellerProductId" AS "productId", w."priceWhenSaved", w."createdAt" AS "savedAt",
              w."createdBy", w."creatorType", w."creatorName", w."updatedBy", w."updaterType", w."updaterName", w."updatedAt",
              u.id AS "userId", u.name AS "userName", u.phone AS "userPhone", u.email AS "userEmail",
              s.phone AS "sellerPhone", s.email AS "sellerEmail",
              ${LIVE_COLUMNS}
         FROM wishlist w
         LEFT JOIN "user" u ON u.id = w."userId"
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
          savedAt: r.savedAt,
          priceWhenSaved: saved,
          createdBy: r.createdBy,
          creatorType: r.creatorType,
          creatorName: r.creatorName,
          updatedBy: r.updatedBy,
          updaterType: r.updaterType,
          updaterName: r.updaterName,
          updatedAt: r.updatedAt,
          user: { id: r.userId, name: r.userName, phone: r.userPhone, email: r.userEmail },
          seller: r.sellerId ? { id: r.sellerId, name: r.sellerName, phone: r.sellerPhone, email: r.sellerEmail } : null,
          product: {
            id: r.productId,
            name: r.name,
            slug: r.slug,
            thumbnailUrl: r.thumbnailUrl,
            status: r.pStatus,
            activeStatus: r.pActive,
            deleted: !!r.pDeleted,
            price,
            stock: r.stock ?? 0,
            wishlistCount: r.wishlistCount,
          },
          priceChange: priceChange(price, saved),
          ...availabilityOf(r),
        };
      }),
    };
  }

  /** One customer's list, for the user page. */
  async forUser(userId: number, query: AdminListWishlistQueryDto, pagination: CursorPagination) {
    const exists = await this.users.exists({ where: { id: userId }, withDeleted: true });
    if (!exists) throw new NotFoundException('User not found');
    return this.adminList({ ...query, userId }, pagination);
  }

  /** Products with the most saves, busiest first. */
  async mostSaved(opts: { sellerId?: number; categoryId?: number; limit?: number; search?: string }) {
    const params: unknown[] = [];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = [`p."deletedAt" IS NULL`, `p."wishlistCount" > 0`];
    if (opts.sellerId !== undefined) where.push(`p."sellerId" = ${add(opts.sellerId)}`);
    if (opts.categoryId !== undefined) where.push(`p."categoryId" = ${add(opts.categoryId)}`);
    if (opts.search) where.push(`p.name ILIKE ${add(likeContains(opts.search))}`);
    const rows: Array<Record<string, any>> = await this.repo.query(
      `SELECT p.id, p.name, p.slug, p."thumbnailUrl", p."wishlistCount", p.status, p."activeStatus",
              s.id AS "sellerId", s.name AS "sellerName", c.id AS "categoryId", c.name AS "categoryName"
         FROM seller_product p
         LEFT JOIN seller s ON s.id = p."sellerId"
         LEFT JOIN category c ON c.id = p."categoryId"
        WHERE ${where.join(' AND ')}
        ORDER BY p."wishlistCount" DESC, p.id DESC
        LIMIT ${add(opts.limit ?? 20)}`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      thumbnailUrl: r.thumbnailUrl,
      wishlistCount: r.wishlistCount,
      status: r.status,
      activeStatus: r.activeStatus,
      seller: { id: r.sellerId, name: r.sellerName },
      category: r.categoryId ? { id: r.categoryId, name: r.categoryName } : null,
    }));
  }

  /** The seller's own demand: totals and top products. Counts only, never who. */
  async sellerInsights(sellerId: number, limit = 10, search?: string) {
    const [totals] = await this.repo.query(
      `SELECT COALESCE(SUM("wishlistCount"), 0)::int AS "totalSaves",
              COUNT(*) FILTER (WHERE "wishlistCount" > 0)::int AS "productsSaved",
              COUNT(*)::int AS "products"
         FROM seller_product WHERE "sellerId" = $1 AND "deletedAt" IS NULL`,
      [sellerId],
    );
    return { ...totals, top: await this.mostSaved({ sellerId, limit, search }) };
  }
}
