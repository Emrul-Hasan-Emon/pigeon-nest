import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review/review.entity';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { ListSellerReviewsQueryDto } from '../dtos/review.dtos';
import { CommonReviewService } from './common-review.service';

/** A seller reads reviews of their own products. Customers appear only as a masked name. */
@Injectable()
export class SellerReviewService {
  constructor(
    @InjectRepository(Review) private readonly repo: Repository<Review>,
    private readonly common: CommonReviewService,
  ) {}

  async list(sellerId: number, query: ListSellerReviewsQueryDto, pagination: CursorPagination) {
    const params: unknown[] = [sellerId];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = [`p."sellerId" = $1`, `r.status = 'published'`, `r."deletedAt" IS NULL`];
    if (query.productId !== undefined) where.push(`r."sellerProductId" = ${add(query.productId)}`);
    if (query.rating !== undefined) where.push(`r.rating = ${add(query.rating)}`);
    const replied = `EXISTS (SELECT 1 FROM review_reply x WHERE x."reviewId" = r.id AND x."authorType" = 'seller'
                              AND x."authorId" = $1 AND x."deletedAt" IS NULL)`;
    if (query.unreplied === true) where.push(`NOT ${replied}`);
    if (query.unreplied === false) where.push(replied);
    if (pagination.cursor > 0) where.push(`r.id < ${add(pagination.cursor)}`);

    const rows: any[] = await this.repo.query(
      `SELECT r.id, r."sellerProductId" AS "productId", p.name AS "productName", p.slug AS "productSlug",
              r.rating, r.title, r.comment, r."helpfulCount", r."replyCount", r."editedAt", r."createdAt",
              u.name AS "userName", oi."skuData", ${replied} AS "sellerReplied"
         FROM review r
         JOIN seller_product p ON p.id = r."sellerProductId"
         JOIN "user" u ON u.id = r."userId"
         JOIN order_item oi ON oi.id = r."orderItemId"
        WHERE ${where.join(' AND ')}
        ORDER BY r.id DESC LIMIT ${add(pagination.limit)}`,
      params,
    );
    const page = getCursorPaginateData<{ id: number }>(rows, pagination.limit);
    const images = await this.common.imagesFor(this.repo.manager, page.results.map((r) => r.id));
    return {
      ...page,
      results: (page.results as any[]).map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        productSlug: r.productSlug,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        images: images.get(r.id) ?? [],
        reviewerName: this.common.maskName(r.userName),
        skuData: r.skuData,
        helpfulCount: r.helpfulCount,
        replyCount: r.replyCount,
        sellerReplied: r.sellerReplied,
        editedAt: r.editedAt,
        createdAt: r.createdAt,
      })),
    };
  }

  /** The shop's rating overall (or for one product), and how many reviews still wait for an answer. */
  async summary(sellerId: number, productId?: number) {
    const params: unknown[] = [sellerId];
    let product = '';
    if (productId !== undefined) {
      params.push(productId);
      product = `AND r."sellerProductId" = $2`;
    }
    const rows: { rating: number; n: number }[] = await this.repo.query(
      `SELECT r.rating, COUNT(*)::int AS n FROM review r JOIN seller_product p ON p.id = r."sellerProductId"
        WHERE p."sellerId" = $1 AND r.status = 'published' AND r."deletedAt" IS NULL ${product} GROUP BY r.rating`,
      params,
    );
    const breakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let count = 0;
    let sum = 0;
    for (const r of rows) {
      breakdown[String(r.rating)] = r.n;
      count += r.n;
      sum += r.n * r.rating;
    }
    const [{ n: unreplied }] = await this.repo.query(
      `SELECT COUNT(*)::int AS n FROM review r JOIN seller_product p ON p.id = r."sellerProductId"
        WHERE p."sellerId" = $1 AND r.status = 'published' AND r."deletedAt" IS NULL ${product}
          AND NOT EXISTS (SELECT 1 FROM review_reply x WHERE x."reviewId" = r.id AND x."authorType" = 'seller'
                            AND x."authorId" = $1 AND x."deletedAt" IS NULL)`,
      params,
    );
    return {
      ratingCount: count,
      ratingAverage: count === 0 ? 0 : Math.round((sum / count) * 100) / 100,
      breakdown,
      unreplied,
    };
  }
}
