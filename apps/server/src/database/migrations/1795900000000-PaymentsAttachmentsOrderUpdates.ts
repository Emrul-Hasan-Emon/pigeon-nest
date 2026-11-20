import { MigrationInterface, QueryRunner } from 'typeorm';

const TRACK = `
  "id" SERIAL NOT NULL,
  "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
  "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP`;

// Payment proof files, the history of payment status changes, and order
// updates (text and files from the seller or admin).
export class PaymentsAttachmentsOrderUpdates1795900000000 implements MigrationInterface {
  name = 'PaymentsAttachmentsOrderUpdates1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "payment_attachments" (${TRACK},
      "paymentId" integer NOT NULL, "orderId" integer NOT NULL,
      "kind" character varying(10) NOT NULL, "fileName" character varying(255) NOT NULL,
      "fileUrl" character varying(1000) NOT NULL, "filePath" character varying(1000) NOT NULL,
      "mimeType" character varying(150) NOT NULL, "size" integer NOT NULL,
      CONSTRAINT "PK_payment_attachments" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_attachments_paymentId" ON "payment_attachments" ("paymentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_attachments_orderId" ON "payment_attachments" ("orderId")`);
    await queryRunner.query(`ALTER TABLE "payment_attachments" ADD CONSTRAINT "FK_payment_attachments_paymentId" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payment_attachments" ADD CONSTRAINT "FK_payment_attachments_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`CREATE TABLE "payment_status_history" (${TRACK},
      "orderId" integer NOT NULL, "paymentId" integer,
      "fromStatus" character varying, "status" character varying NOT NULL,
      "amount" numeric(12,2) NOT NULL DEFAULT '0', "amountPaidAfter" numeric(12,2) NOT NULL DEFAULT '0',
      "note" text,
      CONSTRAINT "PK_payment_status_history" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_status_history_orderId" ON "payment_status_history" ("orderId")`);
    await queryRunner.query(`ALTER TABLE "payment_status_history" ADD CONSTRAINT "FK_payment_status_history_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payment_status_history" ADD CONSTRAINT "FK_payment_status_history_paymentId" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    await queryRunner.query(`CREATE TABLE "order_update" (${TRACK},
      "orderId" integer NOT NULL, "message" text,
      CONSTRAINT "PK_order_update" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_order_update_orderId" ON "order_update" ("orderId")`);
    await queryRunner.query(`ALTER TABLE "order_update" ADD CONSTRAINT "FK_order_update_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`CREATE TABLE "order_update_attachments" (${TRACK},
      "orderUpdateId" integer NOT NULL,
      "kind" character varying(10) NOT NULL, "fileName" character varying(255) NOT NULL,
      "fileUrl" character varying(1000) NOT NULL, "filePath" character varying(1000) NOT NULL,
      "mimeType" character varying(150) NOT NULL, "size" integer NOT NULL,
      CONSTRAINT "PK_order_update_attachments" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_order_update_attachments_updateId" ON "order_update_attachments" ("orderUpdateId")`);
    await queryRunner.query(`ALTER TABLE "order_update_attachments" ADD CONSTRAINT "FK_order_update_attachments_updateId" FOREIGN KEY ("orderUpdateId") REFERENCES "order_update"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    // Orders placed before this migration get their opening payment history row.
    await queryRunner.query(`INSERT INTO "payment_status_history" ("orderId","paymentId","fromStatus","status","amount","amountPaidAfter","note","creatorType","creatorName")
      SELECT o."id", (SELECT p."id" FROM "payment" p WHERE p."orderId" = o."id" ORDER BY p."id" LIMIT 1), NULL, o."paymentStatus", 0, o."amountPaid", 'Order placed', 'user', o."recipientName" FROM "order" o`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_update_attachments"`);
    await queryRunner.query(`DROP TABLE "order_update"`);
    await queryRunner.query(`DROP TABLE "payment_status_history"`);
    await queryRunner.query(`DROP TABLE "payment_attachments"`);
  }
}
