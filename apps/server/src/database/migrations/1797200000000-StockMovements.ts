import { MigrationInterface, QueryRunner } from 'typeorm';

// A permanent log of every stock change on every option.
export class StockMovements1797200000000 implements MigrationInterface {
  name = 'StockMovements1797200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "stock_movement" (
        "id" SERIAL NOT NULL,
        "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
        "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "sellerProductId" integer NOT NULL,
        "sellerProductSkuId" integer NOT NULL,
        "sellerId" integer NOT NULL,
        "skuLabel" character varying(200) NOT NULL,
        "change" integer NOT NULL,
        "quantityAfter" integer NOT NULL,
        "reason" character varying(30) NOT NULL,
        "orderId" integer,
        "note" character varying(255),
        CONSTRAINT "PK_stock_movement" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_stock_movement_reason" CHECK ("reason" IN ('initial','edited','order_placed','order_cancelled','order_reopened'))
      )`);
    await q.query(`CREATE INDEX "IDX_stock_movement_product" ON "stock_movement" ("sellerProductId", "id")`);
    await q.query(`CREATE INDEX "IDX_stock_movement_sku" ON "stock_movement" ("sellerProductSkuId")`);
    // Every option already on the shelf starts with one "initial" row, so each history begins with where it stood.
    await q.query(`
      INSERT INTO "stock_movement" ("sellerProductId","sellerProductSkuId","sellerId","skuLabel","change","quantityAfter","reason","note","creatorName")
      SELECT k."sellerProductId", k.id, p."sellerId", COALESCE(NULLIF(k.sku, ''), NULLIF(k.description, ''), 'Option ' || k.id),
             k.quantity, k.quantity, 'initial', 'Stock when the history started', 'System'
        FROM seller_product_sku k JOIN seller_product p ON p.id = k."sellerProductId"
       WHERE k."deletedAt" IS NULL AND p."deletedAt" IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "stock_movement"`);
  }
}
