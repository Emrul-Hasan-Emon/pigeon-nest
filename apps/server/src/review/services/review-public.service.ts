import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review/review.entity';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { StorefrontProductService } from '../../storefront/storefront-product.service';
import { ListProductReviewsQueryDto, ReviewSort } from '../dtos/review.dtos';
import { ReviewCoreService } from './review-core.service';

/** What anyone may read: a product's rating and its published reviews. Names are masked. */
@Injectable()
export class ReviewPublicService {
  constructor(
    @InjectRepository(Review) private readonly repo: Repository<Review>,
    private readonly storefront: StorefrontProductService,
    private readonly core: ReviewCoreService,
  ) {}

  private async visibleProduct(productId: number) {
    const product = await this.storefront.eligibleProducts().andWhere('p.id = :id', { id: productId }).getOne();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async summary(productId: number) {
    const product = await this.visibleProduct(productId);
    const rows: { rating: number; n: number }[] = await this.repo.query(
      `SELECT rating, COUNT(*)::int AS n FROM review
        WHERE "sellerProductId" = $1 AND status = 'published' AND "deletedAt" IS NULL GROUP BY rating`,
      [productId],
    );
    const breakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const r of rows) breakdown[String(r.rating)] = r.n;
    return { productId, ratingAverage: product.ratingAverage, ratingCount: product.ratingCount, breakdown };
  }

  async list(productId: number, query: ListProductReviewsQueryDto, pagination: CursorPagination) {
    await this.visibleProduct(productId);
    const params: unknown[] = [productId];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = [`r."sellerProductId" = $1`, `r.status = 'published'`, `r."deletedAt" IS NULL`];
    if (query.rating !== undefined) where.push(`r.rating = ${add(query.rating)}`);
    if (query.withPhotos) {
      where.push(`EXISTS (SELECT 1 FROM review_attachment a WHERE a."reviewId" = r.id AND a."deletedAt" IS NULL)`);
    }

    // newest pages by id; helpful pages by offset because the order is not the id
    const helpful = query.sort === ReviewSort.HELPFUL;
    const offset = helpful ? pagination.cursor : 0;
    if (!helpful && pagination.cursor > 0) where.push(`r.id < ${add(pagination.cursor)}`);

    const rows: any[] = await this.repo.query(
      `SELECT r.id, r.rating, r.title, r.comment, r."helpfulCount", r."replyCount", r."editedAt", r."createdAt",
              u.name AS "userName", oi."skuData"
         FROM review r
         JOIN "user" u ON u.id = r."userId"
         JOIN order_item oi ON oi.id = r."orderItemId"
        WHERE ${where.join(' AND ')}
        ORDER BY ${helpful ? 'r."helpfulCount" DESC, r.id DESC' : 'r.id DESC'}
        LIMIT ${add(pagination.limit)} OFFSET ${add(offset)}`,
      params,
    );
    const pageSize = pagination.limit - 1;
    const hasNext = rows.length > pageSize;
    const slice = rows.slice(0, pageSize);
    const images = await this.core.imagesFor(this.repo.manager, slice.map((r) => r.id));
    const results = slice.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      images: images.get(r.id) ?? [],
      reviewerName: this.core.maskName(r.userName),
      verifiedPurchase: true,
      skuData: r.skuData,
      helpfulCount: r.helpfulCount,
      replyCount: r.replyCount,
      editedAt: r.editedAt,
      createdAt: r.createdAt,
    }));
    const last = slice[slice.length - 1];
    const nextCursor = !hasNext ? null : helpful ? offset + pageSize : last.id;
    return { results, nextCursor };
  }

  /** Published reviews across all of one shop's products, newest first. Only for a shop customers can see. */
  async listForSeller(sellerId: number, query: ListProductReviewsQueryDto, pagination: CursorPagination) {
    const visible = await this.repo.query(
      `SELECT 1 FROM seller WHERE id = $1 AND status = 'approved' AND "activeStatus" = 'active' AND "deletedAt" IS NULL`,
      [sellerId],
    );
    if (visible.length === 0) throw new NotFoundException('Seller not found');
    const params: unknown[] = [sellerId];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = [`p."sellerId" = $1`, `r.status = 'published'`, `r."deletedAt" IS NULL`];
    if (query.rating !== undefined) where.push(`r.rating = ${add(query.rating)}`);
    if (pagination.cursor > 0) where.push(`r.id < ${add(pagination.cursor)}`);
    const rows: any[] = await this.repo.query(
      `SELECT r.id, r."sellerProductId" AS "productId", p.name AS "productName", p.slug AS "productSlug",
              r.rating, r.title, r.comment, r."helpfulCount", r."createdAt", u.name AS "userName"
         FROM review r
         JOIN seller_product p ON p.id = r."sellerProductId"
         JOIN "user" u ON u.id = r."userId"
        WHERE ${where.join(' AND ')}
        ORDER BY r.id DESC LIMIT ${add(pagination.limit)}`,
      params,
    );
    const pageSize = pagination.limit - 1;
    const slice = rows.slice(0, pageSize);
    const images = await this.core.imagesFor(this.repo.manager, slice.map((r) => r.id));
    return {
      results: slice.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        productSlug: r.productSlug,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        images: images.get(r.id) ?? [],
        reviewerName: this.core.maskName(r.userName),
        helpfulCount: r.helpfulCount,
        createdAt: r.createdAt,
      })),
      nextCursor: rows.length > pageSize ? slice[slice.length - 1].id : null,
    };
  }
}
