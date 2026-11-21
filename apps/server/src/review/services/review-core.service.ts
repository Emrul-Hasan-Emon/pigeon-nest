import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Seller } from '../../database/entities/seller/seller.entity';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ReviewStatus, ReviewTarget } from '../../database/enums/review.enums';
import { Actor } from '../../shared/types/actor.type';

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

/** Pieces every review service needs: the public name, the product rating, status history, photos. */
@Injectable()
export class ReviewCoreService {
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
}
