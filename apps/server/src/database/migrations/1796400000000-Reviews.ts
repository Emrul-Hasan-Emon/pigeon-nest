import { MigrationInterface, QueryRunner } from 'typeorm';

const TRACKER = `
  "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
  "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP`;

// Reviews: verified-purchase reviews with photos, edit and status history,
// helpful votes, reports and threaded replies, plus a running rating on every product.
// The first review table (never used) is replaced.
export class Reviews1796400000000 implements MigrationInterface {
  name = 'Reviews1796400000000';

  public async up(q: QueryRunner): Promise<void> {
    const [{ n }] = await q.query(`SELECT COUNT(*)::int AS n FROM "review"`);
    if (n > 0) throw new Error('review table has rows: migrate them by hand before running this');
    await q.query(`DROP TABLE "review"`);

    await q.query(`CREATE TABLE "review" ("id" SERIAL NOT NULL, ${TRACKER},
      "userId" integer NOT NULL, "sellerProductId" integer NOT NULL, "orderId" integer NOT NULL, "orderItemId" integer NOT NULL,
      "rating" integer NOT NULL, "title" character varying(150), "comment" text,
      "status" character varying(20) NOT NULL DEFAULT 'published', "hiddenReason" text, "hiddenAt" TIMESTAMPTZ, "editedAt" TIMESTAMPTZ,
      "helpfulCount" integer NOT NULL DEFAULT 0, "reportCount" integer NOT NULL DEFAULT 0, "replyCount" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_review" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_review_rating" CHECK ("rating" BETWEEN 1 AND 5),
      CONSTRAINT "CHK_review_counters" CHECK ("helpfulCount" >= 0 AND "reportCount" >= 0 AND "replyCount" >= 0),
      CONSTRAINT "FK_review_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_review_sellerProductId" FOREIGN KEY ("sellerProductId") REFERENCES "seller_product"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_review_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_review_orderItemId" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE UNIQUE INDEX "UQ_review_live_order_item" ON "review" ("orderItemId") WHERE "deletedAt" IS NULL`);
    await q.query(`CREATE INDEX "IDX_review_product_status" ON "review" ("sellerProductId", "status")`);
    await q.query(`CREATE INDEX "IDX_review_userId" ON "review" ("userId")`);
    await q.query(`CREATE INDEX "IDX_review_orderId" ON "review" ("orderId")`);

    await q.query(`CREATE TABLE "review_attachment" ("id" SERIAL NOT NULL, ${TRACKER},
      "reviewId" integer NOT NULL, "fileName" character varying(255) NOT NULL, "fileUrl" character varying(1000) NOT NULL,
      "filePath" character varying(1000) NOT NULL, "mimeType" character varying(150) NOT NULL, "size" integer NOT NULL, "sortOrder" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_review_attachment" PRIMARY KEY ("id"),
      CONSTRAINT "FK_review_attachment_reviewId" FOREIGN KEY ("reviewId") REFERENCES "review"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE INDEX "IDX_review_attachment_reviewId" ON "review_attachment" ("reviewId")`);

    await q.query(`CREATE TABLE "review_edit_history" ("id" SERIAL NOT NULL, ${TRACKER},
      "reviewId" integer NOT NULL, "fromRating" integer NOT NULL, "toRating" integer NOT NULL,
      "fromTitle" character varying(150), "toTitle" character varying(150), "fromComment" text, "toComment" text,
      "imagesAdded" integer NOT NULL DEFAULT 0, "imagesRemoved" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_review_edit_history" PRIMARY KEY ("id"),
      CONSTRAINT "FK_review_edit_history_reviewId" FOREIGN KEY ("reviewId") REFERENCES "review"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE INDEX "IDX_review_edit_history_reviewId" ON "review_edit_history" ("reviewId")`);

    await q.query(`CREATE TABLE "review_status_history" ("id" SERIAL NOT NULL, ${TRACKER},
      "targetType" character varying(10) NOT NULL, "targetId" integer NOT NULL, "reviewId" integer NOT NULL,
      "fromStatus" character varying(20) NOT NULL, "toStatus" character varying(20) NOT NULL, "reason" text,
      CONSTRAINT "PK_review_status_history" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_review_status_history_target" ON "review_status_history" ("targetType", "targetId")`);
    await q.query(`CREATE INDEX "IDX_review_status_history_reviewId" ON "review_status_history" ("reviewId")`);

    await q.query(`CREATE TABLE "review_helpful_vote" ("id" SERIAL NOT NULL, ${TRACKER},
      "reviewId" integer NOT NULL, "userId" integer NOT NULL,
      CONSTRAINT "PK_review_helpful_vote" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_review_helpful_vote" UNIQUE ("reviewId", "userId"),
      CONSTRAINT "FK_review_helpful_vote_reviewId" FOREIGN KEY ("reviewId") REFERENCES "review"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_review_helpful_vote_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE INDEX "IDX_review_helpful_vote_userId" ON "review_helpful_vote" ("userId")`);

    await q.query(`CREATE TABLE "review_report" ("id" SERIAL NOT NULL, ${TRACKER},
      "targetType" character varying(10) NOT NULL, "targetId" integer NOT NULL, "reviewId" integer NOT NULL,
      "reporterType" character varying(10) NOT NULL, "reporterId" integer NOT NULL, "reporterName" character varying(255) NOT NULL,
      "reason" character varying(20) NOT NULL, "note" text, "status" character varying(20) NOT NULL DEFAULT 'open',
      "resolvedAt" TIMESTAMPTZ, "resolvedBy" integer, "resolvedByName" character varying(255), "resolutionNote" text,
      CONSTRAINT "PK_review_report" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE UNIQUE INDEX "UQ_review_report_open" ON "review_report" ("targetType", "targetId", "reporterType", "reporterId") WHERE "status" = 'open' AND "deletedAt" IS NULL`,
    );
    await q.query(`CREATE INDEX "IDX_review_report_status" ON "review_report" ("status", "id")`);
    await q.query(`CREATE INDEX "IDX_review_report_reviewId" ON "review_report" ("reviewId")`);

    await q.query(`CREATE TABLE "review_reply" ("id" SERIAL NOT NULL, ${TRACKER},
      "reviewId" integer NOT NULL, "parentId" integer, "depth" integer NOT NULL, "path" character varying(300) NOT NULL,
      "authorType" character varying(10) NOT NULL, "authorId" integer NOT NULL, "authorName" character varying(255) NOT NULL,
      "replyToName" character varying(255), "body" text NOT NULL,
      "status" character varying(20) NOT NULL DEFAULT 'published', "hiddenReason" text, "hiddenAt" TIMESTAMPTZ, "editedAt" TIMESTAMPTZ,
      "replyCount" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_review_reply" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_review_reply_depth" CHECK ("depth" >= 1),
      CONSTRAINT "FK_review_reply_reviewId" FOREIGN KEY ("reviewId") REFERENCES "review"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_review_reply_parentId" FOREIGN KEY ("parentId") REFERENCES "review_reply"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE INDEX "IDX_review_reply_thread" ON "review_reply" ("reviewId", "parentId", "id")`);
    await q.query(`CREATE INDEX "IDX_review_reply_author" ON "review_reply" ("authorType", "authorId")`);
    await q.query(`CREATE INDEX "IDX_review_reply_path" ON "review_reply" ("path")`);

    await q.query(`ALTER TABLE "seller_product" ADD COLUMN "ratingCount" integer NOT NULL DEFAULT 0,
      ADD COLUMN "ratingSum" integer NOT NULL DEFAULT 0, ADD COLUMN "ratingAverage" double precision NOT NULL DEFAULT 0`);
    await q.query(
      `ALTER TABLE "seller_product" ADD CONSTRAINT "CHK_seller_product_rating" CHECK ("ratingCount" >= 0 AND "ratingSum" >= 0 AND "ratingAverage" BETWEEN 0 AND 5)`,
    );
    await q.query(`CREATE INDEX "IDX_seller_product_ratingAverage" ON "seller_product" ("ratingAverage")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_seller_product_ratingAverage"`);
    await q.query(`ALTER TABLE "seller_product" DROP CONSTRAINT "CHK_seller_product_rating"`);
    await q.query(`ALTER TABLE "seller_product" DROP COLUMN "ratingAverage", DROP COLUMN "ratingSum", DROP COLUMN "ratingCount"`);
    for (const t of ['review_reply', 'review_report', 'review_helpful_vote', 'review_status_history', 'review_edit_history', 'review_attachment', 'review']) {
      await q.query(`DROP TABLE "${t}"`);
    }
    // the first, never-used schema
    await q.query(`CREATE TABLE "review" ("id" SERIAL NOT NULL, ${TRACKER},
      "userId" integer NOT NULL, "sellerProductId" integer NOT NULL, "orderId" integer, "rating" integer NOT NULL,
      "comment" text, "images" jsonb, "isApproved" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_review_old" PRIMARY KEY ("id"))`);
  }
}
