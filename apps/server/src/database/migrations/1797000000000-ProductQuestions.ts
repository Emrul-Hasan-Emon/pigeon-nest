import { MigrationInterface, QueryRunner } from 'typeorm';

// Buyers ask a seller about a product; the seller answers. A moderator can hide a question.
export class ProductQuestions1797000000000 implements MigrationInterface {
  name = 'ProductQuestions1797000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "product_question" (
        "id" SERIAL NOT NULL,
        "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
        "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "sellerProductId" integer NOT NULL,
        "sellerId" integer NOT NULL,
        "userId" integer NOT NULL,
        "question" text NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'published',
        "hiddenReason" text,
        "hiddenAt" TIMESTAMP,
        "answer" text,
        "answeredAt" TIMESTAMP,
        CONSTRAINT "PK_product_question" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_product_question_status" CHECK ("status" IN ('published','hidden')),
        CONSTRAINT "FK_product_question_product" FOREIGN KEY ("sellerProductId") REFERENCES "seller_product"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_question_seller" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_question_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "IDX_product_question_product_status" ON "product_question" ("sellerProductId", "status")`);
    await q.query(`CREATE INDEX "IDX_product_question_seller_answered" ON "product_question" ("sellerId", "answeredAt")`);
    await q.query(`CREATE INDEX "IDX_product_question_user" ON "product_question" ("userId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "product_question"`);
  }
}
