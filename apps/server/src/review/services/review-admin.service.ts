import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Review } from '../../database/entities/review/review.entity';
import { ReviewReportStatus, ReviewStatus, ReviewTarget } from '../../database/enums/review.enums';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { Actor } from '../../shared/types/actor.type';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { AdminListReportsQueryDto, AdminListReviewsQueryDto, ResolveReportDto } from '../dtos/review.dtos';
import { ReviewCoreService, touched } from './review-core.service';

/** Admin: read every review, hide or restore it, and settle reports. Admins never edit review text. */
@Injectable()
export class ReviewAdminService {
  constructor(
    @InjectRepository(Review) private readonly repo: Repository<Review>,
    private readonly core: ReviewCoreService,
  ) {}

  async list(query: AdminListReviewsQueryDto, pagination: CursorPagination) {
    const params: unknown[] = [];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = [`r."deletedAt" IS NULL`];
    if (query.productId !== undefined) where.push(`r."sellerProductId" = ${add(query.productId)}`);
    if (query.sellerId !== undefined) where.push(`p."sellerId" = ${add(query.sellerId)}`);
    if (query.userId !== undefined) where.push(`r."userId" = ${add(query.userId)}`);
    if (query.rating !== undefined) where.push(`r.rating = ${add(query.rating)}`);
    if (query.status !== undefined) where.push(`r.status = ${add(query.status)}`);
    if (query.reported === true) where.push(`r."reportCount" > 0`);
    if (query.reported === false) where.push(`r."reportCount" = 0`);
    if (query.from) where.push(`r."createdAt" >= ${add(query.from)}`);
    if (query.to) where.push(`r."createdAt" <= ${add(query.to)}`);
    if (query.search) {
      const q = add(likeContains(query.search));
      where.push(`(u.name ILIKE ${q} OR u.email ILIKE ${q} OR u.phone ILIKE ${q} OR p.name ILIKE ${q} OR r.comment ILIKE ${q} OR r.title ILIKE ${q})`);
    }
    if (pagination.cursor > 0) where.push(`r.id < ${add(pagination.cursor)}`);

    const rows: any[] = await this.repo.query(
      `SELECT r.id, r.rating, r.title, r.comment, r.status, r."hiddenReason", r."hiddenAt", r."helpfulCount", r."reportCount", r."replyCount",
              r."editedAt", r."createdAt", r."orderId", o."orderNumber",
              u.id AS "userId", u.name AS "userName", u.phone AS "userPhone", u.email AS "userEmail",
              s.id AS "sellerId", s.name AS "sellerName",
              p.id AS "productId", p.name AS "productName", p.slug AS "productSlug", p."thumbnailUrl" AS "productThumbnailUrl",
              (SELECT COUNT(*)::int FROM review_attachment a WHERE a."reviewId" = r.id AND a."deletedAt" IS NULL) AS "imageCount"
         FROM review r
         JOIN "user" u ON u.id = r."userId"
         JOIN seller_product p ON p.id = r."sellerProductId"
         JOIN seller s ON s.id = p."sellerId"
         JOIN "order" o ON o.id = r."orderId"
        WHERE ${where.join(' AND ')}
        ORDER BY r.id DESC LIMIT ${add(pagination.limit)}`,
      params,
    );
    const page = getCursorPaginateData<{ id: number }>(rows, pagination.limit);
    return { ...page, results: (page.results as any[]).map((r) => this.row(r)) };
  }

  private row(r: any) {
    return {
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      hiddenReason: r.hiddenReason,
      hiddenAt: r.hiddenAt,
      helpfulCount: r.helpfulCount,
      reportCount: r.reportCount,
      replyCount: r.replyCount,
      imageCount: r.imageCount,
      editedAt: r.editedAt,
      createdAt: r.createdAt,
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      user: { id: r.userId, name: r.userName, phone: r.userPhone, email: r.userEmail },
      seller: { id: r.sellerId, name: r.sellerName },
      product: { id: r.productId, name: r.productName, slug: r.productSlug, thumbnailUrl: r.productThumbnailUrl },
    };
  }

  async details(id: number) {
    const [r] = await this.repo.query(
      `SELECT r.id, r.rating, r.title, r.comment, r.status, r."hiddenReason", r."hiddenAt", r."helpfulCount", r."reportCount", r."replyCount",
              r."editedAt", r."createdAt", r."orderId", o."orderNumber",
              u.id AS "userId", u.name AS "userName", u.phone AS "userPhone", u.email AS "userEmail",
              s.id AS "sellerId", s.name AS "sellerName",
              p.id AS "productId", p.name AS "productName", p.slug AS "productSlug", p."thumbnailUrl" AS "productThumbnailUrl",
              oi."skuData", 0 AS "imageCount"
         FROM review r
         JOIN "user" u ON u.id = r."userId"
         JOIN seller_product p ON p.id = r."sellerProductId"
         JOIN seller s ON s.id = p."sellerId"
         JOIN "order" o ON o.id = r."orderId"
         JOIN order_item oi ON oi.id = r."orderItemId"
        WHERE r.id = $1 AND r."deletedAt" IS NULL`,
      [id],
    );
    if (!r) throw new NotFoundException('Review not found');
    const images = await this.core.imagesFor(this.repo.manager, [id]);
    const edits = await this.repo.query(
      `SELECT id, "fromRating", "toRating", "fromTitle", "toTitle", "fromComment", "toComment", "imagesAdded", "imagesRemoved",
              "createdAt", "creatorName" FROM review_edit_history WHERE "reviewId" = $1 ORDER BY id DESC`,
      [id],
    );
    const history = await this.repo.query(
      `SELECT id, "targetType", "targetId", "fromStatus", "toStatus", reason, "createdAt", "creatorType", "creatorName"
         FROM review_status_history WHERE "reviewId" = $1 ORDER BY id DESC`,
      [id],
    );
    const reports = await this.repo.query(
      `SELECT id, "targetType", "targetId", "reporterType", "reporterId", "reporterName", reason, note, status, "createdAt",
              "resolvedAt", "resolvedByName", "resolutionNote"
         FROM review_report WHERE "reviewId" = $1 AND "deletedAt" IS NULL ORDER BY id DESC`,
      [id],
    );
    const images2 = images.get(id) ?? [];
    return { ...this.row(r), imageCount: images2.length, skuData: r.skuData, images: images2, editHistory: edits, statusHistory: history, reports };
  }

  /** Hides a published review. The product rating drops it straight away. */
  async hide(actor: Actor, id: number, reason: string) {
    await this.repo.manager.transaction((m) => this.hideReview(m, actor, id, reason));
    return this.details(id);
  }

  async restore(actor: Actor, id: number, reason?: string) {
    const [r] = await this.repo.query(`SELECT "sellerProductId" FROM review WHERE id = $1 AND "deletedAt" IS NULL`, [id]);
    if (!r) throw new NotFoundException('Review not found');
    await this.repo.manager.transaction(async (m) => {
      await this.core.lockProduct(m, r.sellerProductId);
      const [row] = await m.query(`SELECT status, "deletedAt" FROM review WHERE id = $1 FOR UPDATE`, [id]);
      if (!row || row.deletedAt) throw new NotFoundException('Review not found');
      if (row.status !== ReviewStatus.HIDDEN) throw new BadRequestException('This review is not hidden');
      const t = touched(actor);
      await m.query(
        `UPDATE review SET status = 'published', "hiddenReason" = NULL, "hiddenAt" = NULL, "updatedAt" = now(),
           "updatedBy" = $2, "updaterType" = $3, "updaterName" = $4 WHERE id = $1`,
        [id, t.updatedBy, t.updaterType, t.updaterName],
      );
      await this.core.recordStatus(m, actor, { type: ReviewTarget.REVIEW, id, reviewId: id }, ReviewStatus.HIDDEN, ReviewStatus.PUBLISHED, reason ?? null);
      await this.core.recomputeRating(m, r.sellerProductId);
    });
    return this.details(id);
  }

  private async hideReview(m: EntityManager, actor: Actor, id: number, reason: string) {
    const [r] = await m.query(`SELECT "sellerProductId" FROM review WHERE id = $1 AND "deletedAt" IS NULL`, [id]);
    if (!r) throw new NotFoundException('Review not found');
    await this.core.lockProduct(m, r.sellerProductId);
    const [row] = await m.query(`SELECT status, "deletedAt" FROM review WHERE id = $1 FOR UPDATE`, [id]);
    if (!row || row.deletedAt) throw new NotFoundException('Review not found');
    if (row.status !== ReviewStatus.PUBLISHED) throw new BadRequestException('This review is already hidden');
    const t = touched(actor);
    await m.query(
      `UPDATE review SET status = 'hidden', "hiddenReason" = $2, "hiddenAt" = now(), "updatedAt" = now(),
         "updatedBy" = $3, "updaterType" = $4, "updaterName" = $5 WHERE id = $1`,
      [id, reason, t.updatedBy, t.updaterType, t.updaterName],
    );
    await this.core.recordStatus(m, actor, { type: ReviewTarget.REVIEW, id, reviewId: id }, ReviewStatus.PUBLISHED, ReviewStatus.HIDDEN, reason);
    await this.core.recomputeRating(m, r.sellerProductId);
  }

  // ---- replies ----

  async hideReply(actor: Actor, replyId: number, reason: string) {
    await this.repo.manager.transaction((m) => this.hideReplyRow(m, actor, replyId, reason));
    return this.replyView(replyId);
  }

  private async hideReplyRow(m: EntityManager, actor: Actor, replyId: number, reason: string) {
    const [x] = await m.query(`SELECT "reviewId", status, "deletedAt" FROM review_reply WHERE id = $1 FOR UPDATE`, [replyId]);
    if (!x || x.deletedAt) throw new NotFoundException('Reply not found');
    if (x.status !== ReviewStatus.PUBLISHED) throw new BadRequestException('This reply is already hidden');
    const t = touched(actor);
    await m.query(
      `UPDATE review_reply SET status = 'hidden', "hiddenReason" = $2, "hiddenAt" = now(), "updatedAt" = now(),
         "updatedBy" = $3, "updaterType" = $4, "updaterName" = $5 WHERE id = $1`,
      [replyId, reason, t.updatedBy, t.updaterType, t.updaterName],
    );
    await this.core.recordStatus(m, actor, { type: ReviewTarget.REPLY, id: replyId, reviewId: x.reviewId }, ReviewStatus.PUBLISHED, ReviewStatus.HIDDEN, reason);
  }

  async restoreReply(actor: Actor, replyId: number, reason?: string) {
    await this.repo.manager.transaction(async (m) => {
      const [x] = await m.query(`SELECT "reviewId", status, "deletedAt" FROM review_reply WHERE id = $1 FOR UPDATE`, [replyId]);
      if (!x || x.deletedAt) throw new NotFoundException('Reply not found');
      if (x.status !== ReviewStatus.HIDDEN) throw new BadRequestException('This reply is not hidden');
      const t = touched(actor);
      await m.query(
        `UPDATE review_reply SET status = 'published', "hiddenReason" = NULL, "hiddenAt" = NULL, "updatedAt" = now(),
           "updatedBy" = $2, "updaterType" = $3, "updaterName" = $4 WHERE id = $1`,
        [replyId, t.updatedBy, t.updaterType, t.updaterName],
      );
      await this.core.recordStatus(m, actor, { type: ReviewTarget.REPLY, id: replyId, reviewId: x.reviewId }, ReviewStatus.HIDDEN, ReviewStatus.PUBLISHED, reason ?? null);
    });
    return this.replyView(replyId);
  }

  private async replyView(id: number) {
    const [r] = await this.repo.query(
      `SELECT id, "reviewId", "parentId", depth, "authorType", "authorId", "authorName", body, status, "hiddenReason", "editedAt", "createdAt", "replyCount"
         FROM review_reply WHERE id = $1`,
      [id],
    );
    return r;
  }

  // ---- reports ----

  async listReports(query: AdminListReportsQueryDto, pagination: CursorPagination) {
    const params: unknown[] = [query.status ?? ReviewReportStatus.OPEN];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = [`g.status = $1`, `g."deletedAt" IS NULL`];
    if (query.targetType) where.push(`g."targetType" = ${add(query.targetType)}`);
    if (query.reviewId !== undefined) where.push(`g."reviewId" = ${add(query.reviewId)}`);
    if (pagination.cursor > 0) where.push(`g.id < ${add(pagination.cursor)}`);
    const rows: any[] = await this.repo.query(
      `SELECT g.id, g."targetType", g."targetId", g."reviewId", g."reporterType", g."reporterId", g."reporterName", g.reason, g.note,
              g.status, g."createdAt", g."resolvedAt", g."resolvedByName", g."resolutionNote",
              p.id AS "productId", p.name AS "productName", s.id AS "sellerId", s.name AS "sellerName",
              CASE WHEN g."targetType" = 'review' THEN COALESCE(r.title, '') || CASE WHEN r.title IS NOT NULL AND r.comment IS NOT NULL THEN ' — ' ELSE '' END || COALESCE(r.comment, '')
                   ELSE x.body END AS "targetText",
              CASE WHEN g."targetType" = 'review' THEN r.status ELSE x.status END AS "targetStatus"
         FROM review_report g
         JOIN review r ON r.id = g."reviewId"
         LEFT JOIN review_reply x ON g."targetType" = 'reply' AND x.id = g."targetId"
         JOIN seller_product p ON p.id = r."sellerProductId"
         JOIN seller s ON s.id = p."sellerId"
        WHERE ${where.join(' AND ')}
        ORDER BY g.id DESC LIMIT ${add(pagination.limit)}`,
      params,
    );
    return getCursorPaginateData(rows as Array<{ id: number }>, pagination.limit);
  }

  /** Hide the reported text (every open report on it closes) or dismiss this one report. */
  async resolve(actor: Actor, reportId: number, dto: ResolveReportDto) {
    await this.repo.manager.transaction(async (m) => {
      const [g] = await m.query(
        `SELECT id, "targetType", "targetId", "reviewId", reason, status FROM review_report WHERE id = $1 AND "deletedAt" IS NULL FOR UPDATE`,
        [reportId],
      );
      if (!g) throw new NotFoundException('Report not found');
      if (g.status !== ReviewReportStatus.OPEN) throw new BadRequestException('This report is already settled');

      if (dto.action === 'hide') {
        const reason = dto.note?.trim() || `Reported as ${g.reason}`;
        // the target may already be hidden by another report; then there is nothing left to hide
        if (g.targetType === ReviewTarget.REVIEW) {
          const [row] = await m.query(`SELECT status FROM review WHERE id = $1`, [g.targetId]);
          if (row?.status === ReviewStatus.PUBLISHED) await this.hideReview(m, actor, g.targetId, reason);
        } else {
          const [row] = await m.query(`SELECT status, "deletedAt" FROM review_reply WHERE id = $1`, [g.targetId]);
          if (row && !row.deletedAt && row.status === ReviewStatus.PUBLISHED) await this.hideReplyRow(m, actor, g.targetId, reason);
        }
        await this.settle(m, actor, { type: g.targetType, id: g.targetId }, ReviewReportStatus.HIDDEN, dto.note ?? null);
      } else {
        await m.query(
          `UPDATE review_report SET status = 'dismissed', "resolvedAt" = now(), "resolvedBy" = $2, "resolvedByName" = $3, "resolutionNote" = $4, "updatedAt" = now()
            WHERE id = $1`,
          [reportId, actor.id, actor.name, dto.note ?? null],
        );
      }
      await m.query(
        `UPDATE review SET "reportCount" = (SELECT COUNT(*)::int FROM review_report
            WHERE "targetType" = 'review' AND "targetId" = review.id AND status = 'open' AND "deletedAt" IS NULL)
          WHERE id = $1`,
        [g.reviewId],
      );
    });
    const [g] = await this.repo.query(
      `SELECT id, "targetType", "targetId", "reviewId", status, "resolvedAt", "resolvedByName", "resolutionNote" FROM review_report WHERE id = $1`,
      [reportId],
    );
    return g;
  }

  private async settle(m: EntityManager, actor: Actor, target: { type: ReviewTarget; id: number }, status: ReviewReportStatus, note: string | null) {
    await m.query(
      `UPDATE review_report SET status = $4, "resolvedAt" = now(), "resolvedBy" = $5, "resolvedByName" = $6, "resolutionNote" = $7, "updatedAt" = now()
        WHERE "targetType" = $1 AND "targetId" = $2 AND status = $3 AND "deletedAt" IS NULL`,
      [target.type, target.id, ReviewReportStatus.OPEN, status, actor.id, actor.name, note],
    );
  }
}
