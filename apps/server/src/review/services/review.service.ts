import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Review } from '../../database/entities/review/review.entity';
import { User } from '../../database/entities/person/user.entity';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { ReviewStatus } from '../../database/enums/review.enums';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { CreateReviewDto, UpdateReviewDto } from '../dtos/review.dtos';
import { EDIT_WINDOW_DAYS, MAX_REVIEW_IMAGES } from '../review.constants';
import { created, customerActor, ReviewCoreService, touched } from './review-core.service';
import { ReviewFileService, StoredReviewImage } from './review-file.service';

const DAY_MS = 24 * 60 * 60 * 1000;

interface OwnRow {
  id: number;
  createdAt: Date;
  [key: string]: any;
}

/** A customer writes, edits, deletes and lists their own reviews. */
@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly repo: Repository<Review>,
    private readonly core: ReviewCoreService,
    private readonly files: ReviewFileService,
  ) {}

  private editableUntil(createdAt: Date) {
    return new Date(new Date(createdAt).getTime() + EDIT_WINDOW_DAYS * DAY_MS);
  }

  /** Rows shaped for the owner: hidden reviews and the reason are visible to them. */
  private async ownerRows(m: EntityManager, where: string, params: unknown[], tail = ''): Promise<any[]> {
    const rows: OwnRow[] = await m.query(
      `SELECT r.id, r."sellerProductId" AS "productId", r."orderId", o."orderNumber", r."orderItemId",
              r.rating, r.title, r.comment, r.status, r."hiddenReason", r."helpfulCount", r."replyCount",
              r."editedAt", r."createdAt", oi."skuData",
              p.name AS "productName", p.slug AS "productSlug", p."thumbnailUrl" AS "productThumbnailUrl"
         FROM review r
         JOIN "order" o ON o.id = r."orderId"
         JOIN order_item oi ON oi.id = r."orderItemId"
         LEFT JOIN seller_product p ON p.id = r."sellerProductId"
        WHERE r."deletedAt" IS NULL AND ${where} ${tail}`,
      params,
    );
    const images = await this.core.imagesFor(m, rows.map((r) => r.id));
    const now = Date.now();
    return rows.map((r) => {
      const until = this.editableUntil(r.createdAt);
      return {
        id: r.id,
        productId: r.productId,
        product: { id: r.productId, name: r.productName, slug: r.productSlug, thumbnailUrl: r.productThumbnailUrl },
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        orderItemId: r.orderItemId,
        skuData: r.skuData,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        images: images.get(r.id) ?? [],
        status: r.status,
        hiddenReason: r.status === ReviewStatus.HIDDEN ? r.hiddenReason : null,
        helpfulCount: r.helpfulCount,
        replyCount: r.replyCount,
        editedAt: r.editedAt,
        createdAt: r.createdAt,
        editableUntil: until,
        canEdit: r.status === ReviewStatus.PUBLISHED && until.getTime() > now,
      };
    });
  }

  async mine(user: User, pagination: CursorPagination) {
    const params: unknown[] = [user.id];
    let where = `r."userId" = $1`;
    if (pagination.cursor > 0) {
      params.push(pagination.cursor);
      where += ` AND r.id < $${params.length}`;
    }
    params.push(pagination.limit);
    const rows = await this.ownerRows(this.repo.manager, where, params, `ORDER BY r.id DESC LIMIT $${params.length}`);
    return getCursorPaginateData(rows, pagination.limit);
  }

  async getMine(user: User, id: number) {
    const [row] = await this.ownerRows(this.repo.manager, `r.id = $1 AND r."userId" = $2`, [id, user.id]);
    if (!row) throw new NotFoundException('Review not found');
    return row;
  }

  /** Delivered order lines the customer has not reviewed yet. */
  async pending(user: User, pagination: CursorPagination) {
    const params: unknown[] = [user.id, OrderStatus.DELIVERED];
    let where = '';
    if (pagination.cursor > 0) {
      params.push(pagination.cursor);
      where = `AND oi.id < $${params.length}`;
    }
    params.push(pagination.limit);
    const rows = await this.repo.query(
      `SELECT oi.id, oi."orderId", o."orderNumber", oi."sellerProductId" AS "productId", oi."productName", oi."skuData",
              p.slug AS "productSlug", p."thumbnailUrl" AS "thumbnailUrl", o."createdAt" AS "orderedAt"
         FROM order_item oi
         JOIN "order" o ON o.id = oi."orderId"
         LEFT JOIN seller_product p ON p.id = oi."sellerProductId"
        WHERE o."userId" = $1 AND o.status = $2 AND oi."deletedAt" IS NULL ${where}
          AND NOT EXISTS (SELECT 1 FROM review r WHERE r."orderItemId" = oi.id AND r."deletedAt" IS NULL)
        ORDER BY oi.id DESC LIMIT $${params.length}`,
      params,
    );
    return getCursorPaginateData<{ id: number }>(rows, pagination.limit);
  }

  /** Which reviews of a product this customer has voted helpful, so the buttons can show it. */
  async votes(user: User, productId: number) {
    const rows: { id: number }[] = await this.repo.query(
      `SELECT v."reviewId" AS id FROM review_helpful_vote v JOIN review r ON r.id = v."reviewId"
        WHERE v."userId" = $1 AND r."sellerProductId" = $2 AND v."deletedAt" IS NULL AND r."deletedAt" IS NULL`,
      [user.id, productId],
    );
    return { reviewIds: rows.map((r) => Number(r.id)) };
  }

  async create(user: User, dto: CreateReviewDto, files: Express.Multer.File[] | undefined) {
    const list = this.files.validate(files);
    const actor = customerActor(user);

    const [item] = await this.repo.query(
      `SELECT oi.id, oi."orderId", oi."sellerProductId", o."userId", o.status
         FROM order_item oi JOIN "order" o ON o.id = oi."orderId"
        WHERE oi.id = $1 AND oi."deletedAt" IS NULL`,
      [dto.orderItemId],
    );
    // someone else's order line looks the same as one that does not exist
    if (!item || item.userId !== user.id) throw new NotFoundException('Order item not found');
    if (item.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('You can review a product once its order is delivered');
    }

    const stored = await this.files.store(list);
    try {
      const id = await this.repo.manager.transaction(async (m) => {
        await this.core.lockProduct(m, item.sellerProductId);
        const dup = await m.query(`SELECT 1 FROM review WHERE "orderItemId" = $1 AND "deletedAt" IS NULL`, [item.id]);
        if (dup.length > 0) throw new ConflictException('You already reviewed this item');
        const [{ id: reviewId }] = await m.query(
          `INSERT INTO review ("userId", "sellerProductId", "orderId", "orderItemId", rating, title, comment,
             "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $8, $9, $10) RETURNING id`,
          [
            user.id, item.sellerProductId, item.orderId, item.id, dto.rating, dto.title ?? null, dto.comment ?? null,
            actor.id, actor.type, actor.name,
          ],
        );
        await this.insertImages(m, reviewId, stored, 0, actor);
        await this.core.recomputeRating(m, item.sellerProductId);
        return reviewId as number;
      });
      return this.getMine(user, id);
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
  }

  private async insertImages(m: EntityManager, reviewId: number, stored: StoredReviewImage[], startAt: number, actor: ReturnType<typeof customerActor>) {
    let order = startAt;
    for (const s of stored) {
      const t = created(actor);
      await m.query(
        `INSERT INTO review_attachment ("reviewId", "fileName", "fileUrl", "filePath", "mimeType", size, "sortOrder",
           "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [reviewId, s.fileName, s.fileUrl, s.filePath, s.mimeType, s.size, order++, t.createdBy, t.creatorType, t.creatorName, t.updatedBy, t.updaterType, t.updaterName],
      );
    }
  }

  async update(user: User, id: number, dto: UpdateReviewDto, files: Express.Multer.File[] | undefined) {
    const actor = customerActor(user);
    const current = await this.repo.findOne({ where: { id, userId: user.id } });
    if (!current) throw new NotFoundException('Review not found');
    if (current.status === ReviewStatus.HIDDEN) throw new ForbiddenException('This review was hidden by a moderator and cannot be edited');
    if (this.editableUntil(current.createdAt).getTime() <= Date.now()) {
      throw new ForbiddenException(`A review can be edited for ${EDIT_WINDOW_DAYS} days after it is posted`);
    }

    const [{ n }] = await this.repo.query(`SELECT COUNT(*)::int AS n FROM review_attachment WHERE "reviewId" = $1 AND "deletedAt" IS NULL`, [id]);
    const removeIds = [...new Set(dto.removeImageIds ?? [])];
    if (removeIds.length > 0) {
      const own: { id: number }[] = await this.repo.query(
        `SELECT id FROM review_attachment WHERE "reviewId" = $1 AND id = ANY($2) AND "deletedAt" IS NULL`,
        [id, removeIds],
      );
      if (own.length !== removeIds.length) throw new BadRequestException('removeImageIds has a photo that is not on this review');
    }
    const list = this.files.validate(files, n - removeIds.length);

    const next = {
      rating: dto.rating ?? current.rating,
      title: dto.title !== undefined ? dto.title : current.title,
      comment: dto.comment !== undefined ? dto.comment : current.comment,
    };
    const changed = next.rating !== current.rating || next.title !== current.title || next.comment !== current.comment;
    if (!changed && removeIds.length === 0 && list.length === 0) throw new BadRequestException('Nothing to change');

    const stored = await this.files.store(list);
    let dropped: { filePath: string }[] = [];
    try {
      await this.repo.manager.transaction(async (m) => {
        await this.core.lockProduct(m, current.sellerProductId);
        const [row] = await m.query(`SELECT status, "deletedAt" FROM review WHERE id = $1 FOR UPDATE`, [id]);
        if (!row || row.deletedAt) throw new NotFoundException('Review not found');
        if (row.status === ReviewStatus.HIDDEN) throw new ForbiddenException('This review was hidden by a moderator and cannot be edited');

        if (removeIds.length > 0) {
          dropped = await m.query(`DELETE FROM review_attachment WHERE "reviewId" = $1 AND id = ANY($2) RETURNING "filePath"`, [id, removeIds]).then((r) => r[0] ?? r);
        }
        await this.insertImages(m, id, stored, n, actor);
        const t = touched(actor);
        await m.query(
          `UPDATE review SET rating = $2, title = $3, comment = $4, "editedAt" = now(), "updatedAt" = now(),
             "updatedBy" = $5, "updaterType" = $6, "updaterName" = $7 WHERE id = $1`,
          [id, next.rating, next.title, next.comment, t.updatedBy, t.updaterType, t.updaterName],
        );
        const c = created(actor);
        await m.query(
          `INSERT INTO review_edit_history ("reviewId", "fromRating", "toRating", "fromTitle", "toTitle", "fromComment", "toComment",
             "imagesAdded", "imagesRemoved", "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $10, $11, $12)`,
          [id, current.rating, next.rating, current.title, next.title, current.comment, next.comment, stored.length, removeIds.length, c.createdBy, c.creatorType, c.creatorName],
        );
        await this.core.recomputeRating(m, current.sellerProductId);
      });
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
    await this.files.discard(dropped);
    return this.getMine(user, id);
  }

  /** Soft delete. The customer can review the same item again afterwards. */
  async remove(user: User, id: number) {
    const actor = customerActor(user);
    const current = await this.repo.findOne({ where: { id, userId: user.id } });
    if (!current) throw new NotFoundException('Review not found');
    await this.repo.manager.transaction(async (m) => {
      await this.core.lockProduct(m, current.sellerProductId);
      const t = touched(actor);
      await m.query(
        `UPDATE review SET "deletedAt" = now(), "updatedBy" = $2, "updaterType" = $3, "updaterName" = $4 WHERE id = $1 AND "deletedAt" IS NULL`,
        [id, t.updatedBy, t.updaterType, t.updaterName],
      );
      // a deleted review settles its open reports
      await m.query(
        `UPDATE review_report SET status = 'dismissed', "resolvedAt" = now(), "resolutionNote" = 'Review deleted by its author', "updatedAt" = now()
          WHERE "reviewId" = $1 AND status = 'open'`,
        [id],
      );
      await m.query(`UPDATE review SET "reportCount" = 0 WHERE id = $1`, [id]);
      await this.core.recomputeRating(m, current.sellerProductId);
    });
    return { id, deleted: true };
  }
}
