import { MigrationInterface, QueryRunner } from 'typeorm';

const TRACKER = `
  "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
  "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP`;

// Returns and refunds, per-item commission, and the commission change log.
//  - order_item gets its own commission; the order's commission becomes the sum of its lines.
//    Old orders keep their total: it is shared out over the lines by amount.
//  - order / order_item get isReturned.
//  - order_return and friends get their real columns, plus an attachments table.
//  - system_commission_history gets status, item id and return id.
//  - system_commission_change_history records every move of a seller's balance.
export class ReturnsRefunds1796600000000 implements MigrationInterface {
  name = 'ReturnsRefunds1796600000000';

  public async up(q: QueryRunner): Promise<void> {
    // ---- per-item commission, isReturned
    await q.query(`ALTER TABLE "order_item" ADD "systemCommission" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order_item" ADD "sellerAmount" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order_item" ADD "isReturned" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "order" ADD "isReturned" boolean NOT NULL DEFAULT false`);
    await q.query(`CREATE INDEX "IDX_order_item_isReturned" ON "order_item" ("isReturned")`);
    await q.query(`CREATE INDEX "IDX_order_isReturned" ON "order" ("isReturned")`);

    // Share each order's commission over its lines by payable amount. The line
    // payable is the proposal price, else the discounted price, else the price.
    await q.query(`
      WITH line AS (
        SELECT i.id, i."orderId",
               COALESCE(i."totalProposalPrice", i."totalDiscountedPrice", i."totalPrice") AS payable,
               o."systemCommission" AS commission, o.subtotal,
               ROW_NUMBER() OVER (PARTITION BY i."orderId" ORDER BY COALESCE(i."totalProposalPrice", i."totalDiscountedPrice", i."totalPrice") DESC, i.id DESC) AS rank
          FROM order_item i JOIN "order" o ON o.id = i."orderId"
         WHERE o."systemCommission" > 0 AND o.subtotal > 0 AND i."deletedAt" IS NULL
      ), share AS (
        SELECT l.*, ROUND((l.commission * l.payable / l.subtotal)::numeric, 2)::double precision AS part FROM line l
      ), fixed AS (
        -- the rounding leftover goes to the biggest line, so the lines add up to the order
        SELECT s.id, s.payable,
               s.part + CASE WHEN s.rank = 1
                 THEN ROUND((s.commission - SUM(s.part) OVER (PARTITION BY s."orderId"))::numeric, 2)::double precision
                 ELSE 0 END AS commission
          FROM share s
      )
      UPDATE order_item i SET "systemCommission" = f.commission,
             "sellerAmount" = ROUND((f.payable - f.commission)::numeric, 2)::double precision
        FROM fixed f WHERE f.id = i.id`);
    await q.query(`UPDATE order_item i SET "sellerAmount" = ROUND(COALESCE(i."totalProposalPrice", i."totalDiscountedPrice", i."totalPrice")::numeric, 2)::double precision
        WHERE i."systemCommission" = 0`);
    await q.query(`ALTER TABLE "order_item" ADD CONSTRAINT "CHK_order_item_systemCommission" CHECK ("systemCommission" >= 0)`);

    // ---- returns
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "media"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "refundMethod"`);
    await q.query(`ALTER TABLE "order_return" ALTER COLUMN "userId" DROP NOT NULL`);
    await q.query(`ALTER TABLE "order_return" ALTER COLUMN "status" TYPE character varying(30)`);
    await q.query(`ALTER TABLE "order_return" ADD "sellerId" integer NOT NULL`);
    await q.query(`ALTER TABLE "order_return" ADD "scope" character varying(20) NOT NULL`);
    await q.query(`ALTER TABLE "order_return" ADD "includeDeliveryCharge" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "order_return" ADD "itemsAmount" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order_return" ADD "deliveryAmount" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order_return" ADD "commissionAmount" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order_return" ADD "returnedAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`CREATE INDEX "IDX_order_return_sellerId" ON "order_return" ("sellerId")`);
    await q.query(
      `ALTER TABLE "order_return" ADD CONSTRAINT "FK_order_return_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT`,
    );
    await q.query(
      `ALTER TABLE "order_return" ADD CONSTRAINT "CHK_order_return_amounts" CHECK ("refundAmount" >= 0 AND "itemsAmount" >= 0 AND "deliveryAmount" >= 0 AND "commissionAmount" >= 0)`,
    );
    await q.query(
      `ALTER TABLE "order_return" ADD CONSTRAINT "CHK_order_return_status" CHECK ("status" IN ('return_requested','accepted','rejected','processing','returning_money','returned','cancelled'))`,
    );
    await q.query(`ALTER TABLE "order_return" ADD CONSTRAINT "CHK_order_return_scope" CHECK ("scope" IN ('full_order','items'))`);

    await q.query(`ALTER TABLE "order_return_item" ADD "refundAmount" double precision NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "order_return_item" ADD "commissionAmount" double precision NOT NULL DEFAULT 0`);
    await q.query(`CREATE INDEX "IDX_order_return_item_orderItemId" ON "order_return_item" ("orderItemId")`);

    await q.query(`ALTER TABLE "order_return_status_history" ALTER COLUMN "status" TYPE character varying(30)`);
    await q.query(`ALTER TABLE "order_return_status_history" ADD "fromStatus" character varying(30)`);

    await q.query(`CREATE TABLE "order_return_attachments" ("id" SERIAL NOT NULL, ${TRACKER},
      "orderReturnId" integer NOT NULL, "statusHistoryId" integer,
      "kind" character varying(10) NOT NULL, "fileName" character varying(255) NOT NULL,
      "fileUrl" character varying(1000) NOT NULL, "filePath" character varying(1000) NOT NULL,
      "mimeType" character varying(150) NOT NULL, "size" integer NOT NULL,
      CONSTRAINT "PK_order_return_attachments" PRIMARY KEY ("id"),
      CONSTRAINT "FK_order_return_attachments_returnId" FOREIGN KEY ("orderReturnId") REFERENCES "order_return"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_order_return_attachments_historyId" FOREIGN KEY ("statusHistoryId") REFERENCES "order_return_status_history"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE INDEX "IDX_order_return_attachments_returnId" ON "order_return_attachments" ("orderReturnId")`);
    await q.query(`CREATE INDEX "IDX_order_return_attachments_historyId" ON "order_return_attachments" ("statusHistoryId")`);

    // ---- commission ledger
    await q.query(`ALTER TABLE "system_commission_history" ADD "status" character varying(40) NOT NULL DEFAULT 'for_system'`);
    await q.query(`ALTER TABLE "system_commission_history" ADD "orderItemId" integer`);
    await q.query(`ALTER TABLE "system_commission_history" ADD "orderReturnId" integer`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_status" ON "system_commission_history" ("status")`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_orderItemId" ON "system_commission_history" ("orderItemId")`);
    await q.query(`CREATE INDEX "IDX_system_commission_history_orderReturnId" ON "system_commission_history" ("orderReturnId")`);
    await q.query(
      `ALTER TABLE "system_commission_history" ADD CONSTRAINT "FK_system_commission_history_orderItemId" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE RESTRICT`,
    );
    await q.query(
      `ALTER TABLE "system_commission_history" ADD CONSTRAINT "FK_system_commission_history_orderReturnId" FOREIGN KEY ("orderReturnId") REFERENCES "order_return"("id") ON DELETE RESTRICT`,
    );

    await q.query(`CREATE TABLE "system_commission_change_history" ("id" SERIAL NOT NULL, ${TRACKER},
      "systemCommissionId" integer NOT NULL, "sellerId" integer NOT NULL, "historyId" integer,
      "currentTotalCommission" double precision NOT NULL, "currentDueCommission" double precision NOT NULL,
      "currentPaidCommission" double precision NOT NULL, "commissionStatus" character varying(40) NOT NULL,
      "newTotalCommission" double precision NOT NULL, "newDueCommission" double precision NOT NULL,
      "newPaidCommission" double precision NOT NULL, "note" text,
      CONSTRAINT "PK_system_commission_change_history" PRIMARY KEY ("id"),
      CONSTRAINT "FK_system_commission_change_history_systemCommissionId" FOREIGN KEY ("systemCommissionId") REFERENCES "system_commission"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_system_commission_change_history_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_system_commission_change_history_historyId" FOREIGN KEY ("historyId") REFERENCES "system_commission_history"("id") ON DELETE RESTRICT)`);
    await q.query(
      `CREATE INDEX "IDX_system_commission_change_history_systemCommissionId" ON "system_commission_change_history" ("systemCommissionId")`,
    );
    await q.query(`CREATE INDEX "IDX_system_commission_change_history_sellerId" ON "system_commission_change_history" ("sellerId")`);
    await q.query(`CREATE INDEX "IDX_system_commission_change_history_historyId" ON "system_commission_change_history" ("historyId")`);
    await q.query(`CREATE INDEX "IDX_system_commission_change_history_status" ON "system_commission_change_history" ("commissionStatus")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "system_commission_change_history"`);
    await q.query(`ALTER TABLE "system_commission_history" DROP CONSTRAINT "FK_system_commission_history_orderReturnId"`);
    await q.query(`ALTER TABLE "system_commission_history" DROP CONSTRAINT "FK_system_commission_history_orderItemId"`);
    await q.query(`DROP INDEX "IDX_system_commission_history_orderReturnId"`);
    await q.query(`DROP INDEX "IDX_system_commission_history_orderItemId"`);
    await q.query(`DROP INDEX "IDX_system_commission_history_status"`);
    await q.query(`ALTER TABLE "system_commission_history" DROP COLUMN "orderReturnId"`);
    await q.query(`ALTER TABLE "system_commission_history" DROP COLUMN "orderItemId"`);
    await q.query(`ALTER TABLE "system_commission_history" DROP COLUMN "status"`);

    await q.query(`DROP TABLE "order_return_attachments"`);
    await q.query(`ALTER TABLE "order_return_status_history" DROP COLUMN "fromStatus"`);
    await q.query(`ALTER TABLE "order_return_status_history" ALTER COLUMN "status" TYPE character varying`);
    await q.query(`DROP INDEX "IDX_order_return_item_orderItemId"`);
    await q.query(`ALTER TABLE "order_return_item" DROP COLUMN "commissionAmount"`);
    await q.query(`ALTER TABLE "order_return_item" DROP COLUMN "refundAmount"`);

    await q.query(`ALTER TABLE "order_return" DROP CONSTRAINT "CHK_order_return_scope"`);
    await q.query(`ALTER TABLE "order_return" DROP CONSTRAINT "CHK_order_return_status"`);
    await q.query(`ALTER TABLE "order_return" DROP CONSTRAINT "CHK_order_return_amounts"`);
    await q.query(`ALTER TABLE "order_return" DROP CONSTRAINT "FK_order_return_sellerId"`);
    await q.query(`DROP INDEX "IDX_order_return_sellerId"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "returnedAt"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "commissionAmount"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "deliveryAmount"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "itemsAmount"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "includeDeliveryCharge"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "scope"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "sellerId"`);
    await q.query(`ALTER TABLE "order_return" ALTER COLUMN "status" TYPE character varying`);
    await q.query(`DELETE FROM "order_return" WHERE "userId" IS NULL`);
    await q.query(`ALTER TABLE "order_return" ALTER COLUMN "userId" SET NOT NULL`);
    await q.query(`ALTER TABLE "order_return" ADD "refundMethod" character varying`);
    await q.query(`ALTER TABLE "order_return" ADD "media" jsonb`);

    await q.query(`ALTER TABLE "order_item" DROP CONSTRAINT "CHK_order_item_systemCommission"`);
    await q.query(`DROP INDEX "IDX_order_isReturned"`);
    await q.query(`DROP INDEX "IDX_order_item_isReturned"`);
    await q.query(`ALTER TABLE "order" DROP COLUMN "isReturned"`);
    await q.query(`ALTER TABLE "order_item" DROP COLUMN "isReturned"`);
    await q.query(`ALTER TABLE "order_item" DROP COLUMN "sellerAmount"`);
    await q.query(`ALTER TABLE "order_item" DROP COLUMN "systemCommission"`);
  }
}
