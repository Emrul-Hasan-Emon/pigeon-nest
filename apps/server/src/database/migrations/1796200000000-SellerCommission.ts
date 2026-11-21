import { MigrationInterface, QueryRunner } from 'typeorm';

const TRACKER = `
  "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
  "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP`;

// Seller commission: per-seller settings with history, order commission
// columns, the commission balance, its ledger, and commission payments.
// The old seller.commissionRate column moves into seller_setting.
export class SellerCommission1796200000000 implements MigrationInterface {
  name = 'SellerCommission1796200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "seller_setting" ("id" SERIAL NOT NULL, ${TRACKER},
      "sellerId" integer NOT NULL, "settingType" character varying(30) NOT NULL,
      "commissionType" character varying(20), "commissionAmount" double precision,
      CONSTRAINT "PK_seller_setting" PRIMARY KEY ("id"),
      CONSTRAINT "FK_seller_setting_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE)`);
    await q.query(
      `CREATE UNIQUE INDEX "UQ_seller_setting_seller_type" ON "seller_setting" ("sellerId", "settingType") WHERE "deletedAt" IS NULL`,
    );

    await q.query(`CREATE TABLE "seller_setting_history" ("id" SERIAL NOT NULL, ${TRACKER},
      "sellerId" integer NOT NULL, "settingId" integer, "settingType" character varying(30) NOT NULL,
      "action" character varying(20) NOT NULL, "fromValue" jsonb, "toValue" jsonb NOT NULL, "note" text,
      CONSTRAINT "PK_seller_setting_history" PRIMARY KEY ("id"),
      CONSTRAINT "FK_seller_setting_history_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_seller_setting_history_settingId" FOREIGN KEY ("settingId") REFERENCES "seller_setting"("id") ON DELETE SET NULL)`);
    await q.query(`CREATE INDEX "IDX_seller_setting_history_sellerId" ON "seller_setting_history" ("sellerId")`);
    await q.query(`CREATE INDEX "IDX_seller_setting_history_type" ON "seller_setting_history" ("settingType")`);

    // Keep any rate that was set on the seller itself.
    await q.query(`INSERT INTO "seller_setting" ("sellerId", "settingType", "commissionType", "commissionAmount", "creatorName")
      SELECT "id", 'commission', 'percentage', "commissionRate", 'Migration' FROM "seller" WHERE "commissionRate" > 0`);
    await q.query(`INSERT INTO "seller_setting_history" ("sellerId", "settingId", "settingType", "action", "toValue", "note", "creatorName")
      SELECT s."sellerId", s."id", 'commission', 'created',
        jsonb_build_object('commissionType', s."commissionType", 'commissionAmount', s."commissionAmount"),
        'Moved from the seller profile', 'Migration' FROM "seller_setting" s`);
    await q.query(`ALTER TABLE "seller" DROP COLUMN "commissionRate"`);

    await q.query(`ALTER TABLE "order" ADD "systemCommission" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order" ADD "sellerAmount" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order" ADD "commissionType" character varying(20)`);
    await q.query(`ALTER TABLE "order" ADD "commissionValue" double precision`);
    await q.query(`UPDATE "order" SET "sellerAmount" = "payableAmount"`);

    await q.query(`CREATE TABLE "system_commission" ("id" SERIAL NOT NULL, ${TRACKER},
      "sellerId" integer NOT NULL, "totalCommission" double precision NOT NULL DEFAULT 0,
      "dueCommission" double precision NOT NULL DEFAULT 0, "paidCommission" double precision NOT NULL DEFAULT 0,
      CONSTRAINT "UQ_system_commission_sellerId" UNIQUE ("sellerId"),
      CONSTRAINT "PK_system_commission" PRIMARY KEY ("id"),
      CONSTRAINT "FK_system_commission_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT)`);

    await q.query(`CREATE TABLE "system_commission_disburse" ("id" SERIAL NOT NULL, ${TRACKER},
      "sellerId" integer NOT NULL, "amount" double precision NOT NULL, "notes" text,
      "totalAmount" double precision NOT NULL, "dueAmount" double precision NOT NULL, "paidAmount" double precision NOT NULL,
      CONSTRAINT "PK_system_commission_disburse" PRIMARY KEY ("id"),
      CONSTRAINT "FK_system_commission_disburse_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT)`);
    await q.query(`CREATE INDEX "IDX_system_commission_disburse_sellerId" ON "system_commission_disburse" ("sellerId")`);

    await q.query(`CREATE TABLE "system_commission_disburse_attachments" ("id" SERIAL NOT NULL, ${TRACKER},
      "disburseId" integer NOT NULL, "kind" character varying(10) NOT NULL, "fileName" character varying(255) NOT NULL,
      "fileUrl" character varying(1000) NOT NULL, "filePath" character varying(1000) NOT NULL,
      "mimeType" character varying(150) NOT NULL, "size" integer NOT NULL,
      CONSTRAINT "PK_system_commission_disburse_attachments" PRIMARY KEY ("id"),
      CONSTRAINT "FK_system_commission_disburse_attachments_disburseId" FOREIGN KEY ("disburseId") REFERENCES "system_commission_disburse"("id") ON DELETE CASCADE)`);
    await q.query(
      `CREATE INDEX "IDX_system_commission_disburse_attachments_disburseId" ON "system_commission_disburse_attachments" ("disburseId")`,
    );

    await q.query(`CREATE TABLE "system_commission_history" ("id" SERIAL NOT NULL, ${TRACKER},
      "sellerId" integer NOT NULL, "orderId" integer, "disburseId" integer, "type" character varying(30) NOT NULL,
      "totalAmount" double precision NOT NULL, "orderSubtotal" double precision,
      "commissionType" character varying(20), "commissionValue" double precision,
      "paymentStatus" character varying(30) NOT NULL,
      "totalAfter" double precision NOT NULL, "dueAfter" double precision NOT NULL, "paidAfter" double precision NOT NULL,
      "voidReason" text,
      CONSTRAINT "PK_system_commission_history" PRIMARY KEY ("id"),
      CONSTRAINT "FK_system_commission_history_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_system_commission_history_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_system_commission_history_disburseId" FOREIGN KEY ("disburseId") REFERENCES "system_commission_disburse"("id") ON DELETE RESTRICT)`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_sellerId" ON "system_commission_history" ("sellerId")`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_orderId" ON "system_commission_history" ("orderId")`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_disburseId" ON "system_commission_history" ("disburseId")`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_type" ON "system_commission_history" ("type")`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_paymentStatus" ON "system_commission_history" ("paymentStatus")`);
    // An order earns commission once at a time: at most one live row per order.
    await q.query(
      `CREATE UNIQUE INDEX "UQ_system_commission_history_live_order" ON "system_commission_history" ("orderId") WHERE "type" = 'order_commission' AND "deletedAt" IS NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "system_commission_history"`);
    await q.query(`DROP TABLE "system_commission_disburse_attachments"`);
    await q.query(`DROP TABLE "system_commission_disburse"`);
    await q.query(`DROP TABLE "system_commission"`);
    await q.query(`ALTER TABLE "order" DROP COLUMN "commissionValue"`);
    await q.query(`ALTER TABLE "order" DROP COLUMN "commissionType"`);
    await q.query(`ALTER TABLE "order" DROP COLUMN "sellerAmount"`);
    await q.query(`ALTER TABLE "order" DROP COLUMN "systemCommission"`);
    await q.query(`ALTER TABLE "seller" ADD "commissionRate" double precision NOT NULL DEFAULT 0`);
    await q.query(`UPDATE "seller" s SET "commissionRate" = t."commissionAmount"
      FROM "seller_setting" t WHERE t."sellerId" = s."id" AND t."settingType" = 'commission'
      AND t."commissionType" = 'percentage' AND t."deletedAt" IS NULL`);
    await q.query(`DROP TABLE "seller_setting_history"`);
    await q.query(`DROP TABLE "seller_setting"`);
  }
}
