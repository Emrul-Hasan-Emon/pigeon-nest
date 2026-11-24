import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Review } from '../../database/entities/review/review.entity';
import { Seller } from '../../database/entities/seller/seller.entity';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ReviewStatus, ReviewTarget } from '../../database/enums/review.enums';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { Actor } from '../../shared/types/actor.type';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { ListRepliesQueryDto, ReplyDto, ReportDto } from '../dtos/review.dtos';
import { EDIT_WINDOW_DAYS, MAX_REPLIES_PER_REVIEW, MAX_REPLY_DEPTH } from '../review.constants';

export const customerActor = (u: User): Actor => ({ id: u.id, type: AuthUserType.USER, name: u.name });
export const sellerActor = (s: Seller): Actor => ({ id: s.id, type: AuthUserType.SELLER, name: s.name });

/** Tracker columns for a new row. */
export const created = (a: Actor) => ({
  createdBy: a.id,
  creatorType: a.type,
  creatorName: a.name,
  updatedBy: a.id,
  updaterType: a.type,
  updaterName: a.name,
});

/** Tracker columns for a change. */
export const touched = (a: Actor) => ({ updatedBy: a.id, updaterType: a.type, updaterName: a.name });

export interface ImageView {
  id: number;
  url: string;
  fileName: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const SUPPORT_NAME = 'Support';

interface ThreadRow {
  id: number;
  parentId: number | null;
  depth: number;
  authorType: AuthUserType;
  authorId: number;
  authorName: string;
  replyToName: string | null;
  body: string;
  status: ReviewStatus;
  hiddenReason: string | null;
  deletedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date;
  replyCount: number;
}

/** What all three roles share: names, ratings, status history, photos, threaded replies and reports. */
@Injectable()
export class CommonReviewService {
  constructor(@InjectRepository(Review) private readonly repo: Repository<Review>) {}

  /** "Rahim Khan" becomes "Rahim K." — the public never sees a full name, phone or email. */
  maskName(name: string | null | undefined): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'Customer';
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${Array.from(parts[parts.length - 1])[0].toUpperCase()}.`;
  }

  /** Serialises every review change on one product, so its rating cannot drift. */
  async lockProduct(m: EntityManager, productId: number) {
    await m.query(`SELECT id FROM seller_product WHERE id = $1 FOR UPDATE`, [productId]);
  }

  /** Rebuilds the product's rating from its published, not-deleted reviews. Call with the product locked. */
  async recomputeRating(m: EntityManager, productId: number) {
    await m.query(
      `UPDATE seller_product p
          SET "ratingCount" = a.n, "ratingSum" = a.s,
              "ratingAverage" = CASE WHEN a.n = 0 THEN 0 ELSE ROUND(a.s::numeric / a.n, 2)::float8 END
         FROM (SELECT COUNT(*)::int AS n, COALESCE(SUM(rating), 0)::int AS s
                 FROM review
                WHERE "sellerProductId" = $1 AND status = 'published' AND "deletedAt" IS NULL) a
        WHERE p.id = $1`,
      [productId],
    );
  }

  async recordStatus(
    m: EntityManager,
    actor: Actor,
    target: { type: ReviewTarget; id: number; reviewId: number },
    from: ReviewStatus,
    to: ReviewStatus,
    reason: string | null,
  ) {
    await m.query(
      `INSERT INTO review_status_history ("targetType", "targetId", "reviewId", "fromStatus", "toStatus", reason,
         "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7, $8, $9)`,
      [target.type, target.id, target.reviewId, from, to, reason, actor.id, actor.type, actor.name],
    );
  }

  /** Photos for a set of reviews, oldest first. */
  async imagesFor(m: EntityManager, reviewIds: number[]): Promise<Map<number, ImageView[]>> {
    const out = new Map<number, ImageView[]>();
    if (reviewIds.length === 0) return out;
    const rows: { id: number; reviewId: number; fileUrl: string; fileName: string }[] = await m.query(
      `SELECT id, "reviewId", "fileUrl", "fileName" FROM review_attachment
        WHERE "reviewId" = ANY($1) AND "deletedAt" IS NULL ORDER BY "sortOrder", id`,
      [reviewIds],
    );
    for (const r of rows) {
      const list = out.get(r.reviewId) ?? [];
      list.push({ id: r.id, url: r.fileUrl, fileName: r.fileName });
      out.set(r.reviewId, list);
    }
    return out;
  }

  // ---------------------------------------------------------------- replies

  /** The name shown beside a reply: a masked customer, the shop, or Support. */
  displayName(actor: Actor): string {
    if (actor.type === AuthUserType.ADMIN) return SUPPORT_NAME;
    if (actor.type === AuthUserType.USER) return this.maskName(actor.name);
    return actor.name;
  }

  private async reviewFor(reviewId: number) {
    const [row] = await this.repo.query(
      `SELECT r.id, r."userId", r.status, r."deletedAt", p."sellerId"
         FROM review r LEFT JOIN seller_product p ON p.id = r."sellerProductId" WHERE r.id = $1`,
      [reviewId],
    );
    if (!row || row.deletedAt) throw new NotFoundException('Review not found');
    return row as { id: number; userId: number; status: ReviewStatus; sellerId: number };
  }

  /** Public thread: hidden replies show as a placeholder, a deleted reply with answers under it too. */
  async thread(reviewId: number, query: ListRepliesQueryDto, pagination: CursorPagination, staff = false) {
    const review = await this.reviewFor(reviewId);
    if (!staff && review.status !== ReviewStatus.PUBLISHED) throw new NotFoundException('Review not found');
    return this.page(reviewId, query.parentId ?? null, pagination, staff);
  }

  private async page(reviewId: number, parentId: number | null, pagination: CursorPagination, staff: boolean) {
    const params: unknown[] = [reviewId];
    let parentSql = 'x."parentId" IS NULL';
    if (parentId !== null) {
      params.push(parentId);
      parentSql = `x."parentId" = $${params.length}`;
    }
    let cursorSql = '';
    if (pagination.cursor > 0) {
      params.push(pagination.cursor);
      cursorSql = `AND x.id > $${params.length}`;
    }
    params.push(pagination.limit);
    // Deleted rows stay only as a placeholder for the answers under them.
    const rows: ThreadRow[] = await this.repo.query(
      `SELECT x.id, x."parentId", x.depth, x."authorType", x."authorId", x."authorName", x."replyToName", x.body, x.status,
              x."hiddenReason", x."deletedAt", x."editedAt", x."createdAt", x."replyCount"
         FROM review_reply x
        WHERE x."reviewId" = $1 AND ${parentSql} AND (x."deletedAt" IS NULL OR x."replyCount" > 0) ${cursorSql}
        ORDER BY x.id ASC LIMIT $${params.length}`,
      params,
    );
    const page = getCursorPaginateData(rows, pagination.limit);
    return {
      ...page,
      results: page.results.map((r) => {
        const deleted = !!r.deletedAt;
        const hidden = !deleted && r.status === ReviewStatus.HIDDEN;
        const showBody = !deleted && (!hidden || staff);
        return {
          id: r.id,
          parentId: r.parentId,
          depth: r.depth,
          authorType: r.authorType,
          authorName: r.authorName,
          ...(staff ? { authorId: r.authorId } : {}),
          replyToName: r.replyToName,
          body: showBody ? r.body : null,
          hidden,
          deleted,
          ...(staff && hidden ? { hiddenReason: r.hiddenReason } : {}),
          editedAt: r.editedAt,
          createdAt: r.createdAt,
          replyCount: r.replyCount,
        };
      }),
    };
  }

  async create(actor: Actor, reviewId: number, dto: ReplyDto) {
    const review = await this.reviewFor(reviewId);
    if (actor.type === AuthUserType.USER && review.userId !== actor.id) {
      throw new ForbiddenException('Only the reviewer, the seller and Support can reply to a review');
    }
    if (actor.type === AuthUserType.SELLER && review.sellerId !== actor.id) {
      throw new NotFoundException('Review not found');
    }
    const authorName = this.displayName(actor);
    const t = created(actor);

    const id = await this.repo.manager.transaction(async (m) => {
      // One thread at a time, so the cap and the counters stay exact.
      const [live] = await m.query(`SELECT status, "deletedAt" FROM review WHERE id = $1 FOR UPDATE`, [reviewId]);
      if (!live || live.deletedAt) throw new NotFoundException('Review not found');
      if (live.status !== ReviewStatus.PUBLISHED) throw new ForbiddenException('This review is hidden, so it cannot be replied to');
      const [{ n }] = await m.query(`SELECT COUNT(*)::int AS n FROM review_reply WHERE "reviewId" = $1 AND "deletedAt" IS NULL`, [reviewId]);
      if (n >= MAX_REPLIES_PER_REVIEW) throw new BadRequestException(`This thread is full (${MAX_REPLIES_PER_REVIEW} replies)`);

      let attachId: number | null = null;
      let attachPath = '';
      let depth = 1;
      let replyToName: string | null = null;
      if (dto.parentId !== undefined) {
        const [parent] = await m.query(
          `SELECT id, "parentId", depth, path, "authorName", status FROM review_reply
            WHERE id = $1 AND "reviewId" = $2 AND "deletedAt" IS NULL`,
          [dto.parentId, reviewId],
        );
        if (!parent) throw new NotFoundException('The reply you are answering was not found');
        if (parent.status === ReviewStatus.HIDDEN) throw new BadRequestException('A hidden reply cannot be answered');
        if (parent.depth >= MAX_REPLY_DEPTH) {
          // Too deep: sit beside the parent, and say who it answers.
          const [grand] = await m.query(`SELECT id, path FROM review_reply WHERE id = $1`, [parent.parentId]);
          attachId = grand.id;
          attachPath = grand.path;
          depth = parent.depth;
          replyToName = parent.authorName;
        } else {
          attachId = parent.id;
          attachPath = parent.path;
          depth = parent.depth + 1;
        }
      }

      const [{ id: replyId }] = await m.query(
        `INSERT INTO review_reply ("reviewId", "parentId", depth, path, "authorType", "authorId", "authorName", "replyToName", body,
           "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
         VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8, $9, $10, $11, $9, $10, $11) RETURNING id`,
        [reviewId, attachId, depth, actor.type, actor.id, authorName, replyToName, dto.body, t.createdBy, t.creatorType, t.creatorName],
      );
      await m.query(`UPDATE review_reply SET path = $2 WHERE id = $1`, [replyId, `${attachPath}${replyId}/`]);
      await m.query(`UPDATE review SET "replyCount" = "replyCount" + 1 WHERE id = $1`, [reviewId]);
      if (attachId !== null) await m.query(`UPDATE review_reply SET "replyCount" = "replyCount" + 1 WHERE id = $1`, [attachId]);
      return replyId as number;
    });
    return this.one(id);
  }

  private async one(id: number) {
    const [r] = await this.repo.query(
      `SELECT id, "reviewId", "parentId", depth, "authorType", "authorName", "replyToName", body, status, "editedAt", "createdAt", "replyCount"
         FROM review_reply WHERE id = $1`,
      [id],
    );
    return r;
  }

  private async ownReply(actor: Actor, replyId: number) {
    const [r] = await this.repo.query(
      `SELECT id, "reviewId", "parentId", "authorType", "authorId", status, "createdAt", "deletedAt" FROM review_reply WHERE id = $1`,
      [replyId],
    );
    // someone else's reply looks the same as one that does not exist
    if (!r || r.deletedAt || r.authorType !== actor.type || r.authorId !== actor.id) throw new NotFoundException('Reply not found');
    return r as { id: number; reviewId: number; parentId: number | null; status: ReviewStatus; createdAt: Date };
  }

  async update(actor: Actor, replyId: number, body: string) {
    const r = await this.ownReply(actor, replyId);
    if (r.status === ReviewStatus.HIDDEN) throw new ForbiddenException('This reply was hidden by a moderator and cannot be edited');
    if (new Date(r.createdAt).getTime() + EDIT_WINDOW_DAYS * DAY_MS <= Date.now()) {
      throw new ForbiddenException(`A reply can be edited for ${EDIT_WINDOW_DAYS} days after it is posted`);
    }
    const t = touched(actor);
    await this.repo.query(
      `UPDATE review_reply SET body = $2, "editedAt" = now(), "updatedAt" = now(), "updatedBy" = $3, "updaterType" = $4, "updaterName" = $5 WHERE id = $1`,
      [replyId, body, t.updatedBy, t.updaterType, t.updaterName],
    );
    return this.one(replyId);
  }

  /** Soft delete. Answers under it stay, under a "deleted" placeholder. */
  async remove(actor: Actor, replyId: number) {
    const r = await this.ownReply(actor, replyId);
    const t = touched(actor);
    await this.repo.manager.transaction(async (m) => {
      await m.query(`SELECT id FROM review WHERE id = $1 FOR UPDATE`, [r.reviewId]);
      const [gone] = await m.query(
        `UPDATE review_reply SET "deletedAt" = now(), "updatedBy" = $2, "updaterType" = $3, "updaterName" = $4
          WHERE id = $1 AND "deletedAt" IS NULL RETURNING id`,
        [replyId, t.updatedBy, t.updaterType, t.updaterName],
      );
      if (!gone || gone.length === 0) return;
      await m.query(`UPDATE review SET "replyCount" = "replyCount" - 1 WHERE id = $1`, [r.reviewId]);
      if (r.parentId !== null) await m.query(`UPDATE review_reply SET "replyCount" = "replyCount" - 1 WHERE id = $1`, [r.parentId]);
      await m.query(
        `UPDATE review_report SET status = 'dismissed', "resolvedAt" = now(), "resolutionNote" = 'Reply deleted by its author', "updatedAt" = now()
          WHERE "targetType" = 'reply' AND "targetId" = $1 AND status = 'open'`,
        [replyId],
      );
    });
    return { id: replyId, deleted: true };
  }

  // ---------------------------------------------------------------- reports

  async publishedReview(id: number) {
    const [r] = await this.repo.query(
      `SELECT r.id, r."userId", r.status, r."deletedAt", p."sellerId"
         FROM review r LEFT JOIN seller_product p ON p.id = r."sellerProductId" WHERE r.id = $1`,
      [id],
    );
    if (!r || r.deletedAt || r.status !== ReviewStatus.PUBLISHED) throw new NotFoundException('Review not found');
    return r as { id: number; userId: number; sellerId: number };
  }


  /** A customer reports someone else's review or reply on a product. */
  async reportReview(actor: Actor, reviewId: number, dto: ReportDto) {
    const review = await this.publishedReview(reviewId);
    this.assertMayReport(actor, review.userId, review.sellerId, false);
    return this.fileReport(actor, ReviewTarget.REVIEW, reviewId, reviewId, dto);
  }

  async reportReply(actor: Actor, replyId: number, dto: ReportDto) {
    const [reply] = await this.repo.query(
      `SELECT x.id, x."reviewId", x."authorType", x."authorId", x.status, x."deletedAt" FROM review_reply x WHERE x.id = $1`,
      [replyId],
    );
    if (!reply || reply.deletedAt || reply.status !== ReviewStatus.PUBLISHED) throw new NotFoundException('Reply not found');
    const review = await this.publishedReview(reply.reviewId);
    this.assertMayReport(actor, review.userId, review.sellerId, true);
    if (reply.authorType === actor.type && reply.authorId === actor.id) {
      throw new BadRequestException('You cannot report your own reply');
    }
    return this.fileReport(actor, ReviewTarget.REPLY, replyId, reply.reviewId, dto);
  }

  /**
   * A seller may report only on their own products. A customer may report any published review but their own;
   * a reply is different: the reviewer may report an abusive answer under their own review (not their own reply).
   */
  private assertMayReport(actor: Actor, reviewUserId: number, sellerId: number, isReply: boolean) {
    if (actor.type === AuthUserType.SELLER && sellerId !== actor.id) throw new NotFoundException('Review not found');
    if (!isReply && actor.type === AuthUserType.USER && reviewUserId === actor.id) {
      throw new ForbiddenException('You cannot report your own review');
    }
  }

  private async fileReport(actor: Actor, type: ReviewTarget, targetId: number, reviewId: number, dto: ReportDto) {
    const t = created(actor);
    try {
      return await this.repo.manager.transaction(async (m) => {
        await m.query(`SELECT id FROM review WHERE id = $1 FOR UPDATE`, [reviewId]);
        const [{ id }] = await m.query(
          `INSERT INTO review_report ("targetType", "targetId", "reviewId", "reporterType", "reporterId", "reporterName", reason, note,
             "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $9, $10, $11) RETURNING id`,
          [type, targetId, reviewId, actor.type, actor.id, actor.name, dto.reason, dto.note ?? null, t.createdBy, t.creatorType, t.creatorName],
        );
        if (type === ReviewTarget.REVIEW) {
          await m.query(`UPDATE review SET "reportCount" = "reportCount" + 1 WHERE id = $1`, [reviewId]);
        }
        return { id, targetType: type, targetId, status: 'open' };
      });
    } catch (error: any) {
      if (error?.code === '23505') throw new ConflictException('You already reported this and it is waiting for review');
      throw error;
    }
  }
}
