import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/person/user.entity';
import { Review } from '../../database/entities/review/review.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ReviewStatus, ReviewTarget } from '../../database/enums/review.enums';
import { Actor } from '../../shared/types/actor.type';
import { ReportDto } from '../dtos/review.dtos';
import { created, customerActor } from './review-core.service';

/** Helpful votes on reviews, and reports on reviews and replies. */
@Injectable()
export class ReviewEngagementService {
  constructor(@InjectRepository(Review) private readonly repo: Repository<Review>) {}

  private async publishedReview(id: number) {
    const [r] = await this.repo.query(
      `SELECT r.id, r."userId", r.status, r."deletedAt", p."sellerId"
         FROM review r LEFT JOIN seller_product p ON p.id = r."sellerProductId" WHERE r.id = $1`,
      [id],
    );
    if (!r || r.deletedAt || r.status !== ReviewStatus.PUBLISHED) throw new NotFoundException('Review not found');
    return r as { id: number; userId: number; sellerId: number };
  }

  /** Mark a review helpful. Voting twice changes nothing. */
  async markHelpful(user: User, reviewId: number) {
    const review = await this.publishedReview(reviewId);
    if (review.userId === user.id) throw new BadRequestException('You cannot vote on your own review');
    const t = created(customerActor(user));
    return this.repo.manager.transaction(async (m) => {
      await m.query(`SELECT id FROM review WHERE id = $1 FOR UPDATE`, [reviewId]);
      const [live] = await m.query(`SELECT status, "deletedAt" FROM review WHERE id = $1`, [reviewId]);
      if (!live || live.deletedAt || live.status !== ReviewStatus.PUBLISHED) throw new NotFoundException('Review not found');
      const added = await m.query(
        `INSERT INTO review_helpful_vote ("reviewId", "userId", "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
         VALUES ($1, $2, $3, $4, $5, $3, $4, $5) ON CONFLICT ("reviewId", "userId") DO NOTHING RETURNING id`,
        [reviewId, user.id, t.createdBy, t.creatorType, t.creatorName],
      );
      if (added.length > 0) await m.query(`UPDATE review SET "helpfulCount" = "helpfulCount" + 1 WHERE id = $1`, [reviewId]);
      const [{ helpfulCount }] = await m.query(`SELECT "helpfulCount" FROM review WHERE id = $1`, [reviewId]);
      return { reviewId, helpful: true, added: added.length > 0, helpfulCount };
    });
  }

  /** Take the vote back. Works on a hidden or deleted review too. */
  async unmarkHelpful(user: User, reviewId: number) {
    return this.repo.manager.transaction(async (m) => {
      await m.query(`SELECT id FROM review WHERE id = $1 FOR UPDATE`, [reviewId]);
      const [gone]: [{ id: number }[], number] = await m.query(
        `DELETE FROM review_helpful_vote WHERE "reviewId" = $1 AND "userId" = $2 RETURNING id`,
        [reviewId, user.id],
      );
      if (gone.length > 0) await m.query(`UPDATE review SET "helpfulCount" = "helpfulCount" - 1 WHERE id = $1`, [reviewId]);
      const [row] = await m.query(`SELECT "helpfulCount" FROM review WHERE id = $1`, [reviewId]);
      return { reviewId, helpful: false, removed: gone.length > 0, helpfulCount: row?.helpfulCount ?? 0 };
    });
  }

  /** A customer reports someone else's review or reply on a product. */
  async reportReview(actor: Actor, reviewId: number, dto: ReportDto) {
    const review = await this.publishedReview(reviewId);
    this.assertMayReport(actor, review.userId, review.sellerId, false);
    return this.file(actor, ReviewTarget.REVIEW, reviewId, reviewId, dto);
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
    return this.file(actor, ReviewTarget.REPLY, replyId, reply.reviewId, dto);
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

  private async file(actor: Actor, type: ReviewTarget, targetId: number, reviewId: number, dto: ReportDto) {
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
