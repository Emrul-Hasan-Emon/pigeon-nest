import { MigrationInterface, QueryRunner } from 'typeorm';

// Money back for cancelled orders: refund records with a status history, and `order.refundStatus` to follow them.
export class OrderRefunds1797600000000 implements MigrationInterface {
  name = 'OrderRefunds1797600000000';

  public async up(q: QueryRunner): Promise<void> {
    const base = `
        "id" SERIAL NOT NULL,
        "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
        "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,`;
    await q.query(`ALTER TABLE "order" ADD "refundStatus" character varying(20)`);
    await q.query(`ALTER TABLE "order" ADD CONSTRAINT "CHK_order_refundStatus" CHECK ("refundStatus" IS NULL OR "refundStatus" IN ('needs_to_refund','processing','refunded'))`);
    await q.query(`CREATE INDEX "IDX_order_refundStatus" ON "order" ("refundStatus") WHERE "refundStatus" IS NOT NULL`);
    await q.query(`
      CREATE TABLE "order_refund" (${base}
        "orderId" integer NOT NULL,
        "sellerId" integer NOT NULL,
        "userId" integer,
        "kind" character varying(20) NOT NULL DEFAULT 'cancelled_order',
        "orderReturnId" integer,
        "status" character varying(20) NOT NULL DEFAULT 'needs_to_refund',
        "expectedAmount" double precision NOT NULL,
        "amount" double precision,
        "note" text,
        "transactionId" character varying(120),
        "proof" jsonb NOT NULL DEFAULT '[]',
        "refundedAt" TIMESTAMPTZ,
        "refundedByName" character varying(120),
        CONSTRAINT "PK_order_refund" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_order_refund_status" CHECK ("status" IN ('needs_to_refund','processing','refunded','voided')),
        CONSTRAINT "CHK_order_refund_kind" CHECK ("kind" IN ('cancelled_order','return')),
        CONSTRAINT "FK_order_refund_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "IDX_order_refund_order" ON "order_refund" ("orderId")`);
    await q.query(`CREATE INDEX "IDX_order_refund_seller_status" ON "order_refund" ("sellerId", "status")`);
    await q.query(`
      CREATE TABLE "order_refund_status_history" (${base}
        "orderRefundId" integer NOT NULL,
        "orderId" integer NOT NULL,
        "fromStatus" character varying(20),
        "status" character varying(20) NOT NULL,
        "amount" double precision,
        "note" text,
        "attachments" jsonb NOT NULL DEFAULT '[]',
        CONSTRAINT "PK_order_refund_status_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_refund_history_refund" FOREIGN KEY ("orderRefundId") REFERENCES "order_refund"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "IDX_order_refund_history_refund" ON "order_refund_status_history" ("orderRefundId")`);
    // Orders cancelled before this feature, with money received, start in "needs to refund" so none is forgotten.
    await q.query(`
      INSERT INTO "order_refund" ("orderId","sellerId","userId","kind","status","expectedAmount","note","creatorName")
      SELECT o.id, o."sellerId", o."userId", 'cancelled_order', 'needs_to_refund', o."amountPaid", 'Order was cancelled before refunds were tracked', 'System'
        FROM "order" o WHERE o.status = 'cancelled' AND o."amountPaid" > 0 AND o."deletedAt" IS NULL`);
    await q.query(`
      INSERT INTO "order_refund_status_history" ("orderRefundId","orderId","fromStatus","status","note","creatorName")
      SELECT r.id, r."orderId", NULL, 'needs_to_refund', r.note, 'System' FROM "order_refund" r`);
    await q.query(`UPDATE "order" o SET "refundStatus" = 'needs_to_refund' WHERE EXISTS (SELECT 1 FROM "order_refund" r WHERE r."orderId" = o.id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "order_refund_status_history"`);
    await q.query(`DROP TABLE "order_refund"`);
    await q.query(`DROP INDEX "IDX_order_refundStatus"`);
    await q.query(`ALTER TABLE "order" DROP CONSTRAINT "CHK_order_refundStatus"`);
    await q.query(`ALTER TABLE "order" DROP COLUMN "refundStatus"`);
  }
}
