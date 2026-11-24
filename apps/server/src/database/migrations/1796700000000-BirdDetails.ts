import { MigrationInterface, QueryRunner } from 'typeorm';

// Pigeon facts on a product and its SKUs.
//  - seller_product: breed, bloodline, notes. True for every SKU of the product.
//  - seller_product_sku: ring number, hatch date, vaccination. One SKU = one bird (or batch).
//  - seller_product_sku_parent: the sire and dam of a SKU's bird, each with an optional photo.
export class BirdDetails1796700000000 implements MigrationInterface {
  name = 'BirdDetails1796700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller_product" ADD "breed" character varying(120)`);
    await q.query(`ALTER TABLE "seller_product" ADD "bloodline" character varying(120)`);
    await q.query(`ALTER TABLE "seller_product" ADD "bloodlineNote" text`);
    await q.query(`ALTER TABLE "seller_product" ADD "vaccinationNote" text`);
    await q.query(`ALTER TABLE "seller_product" ADD "healthNote" text`);
    await q.query(`ALTER TABLE "seller_product" ADD "raceRecord" text`);

    await q.query(`ALTER TABLE "seller_product_sku" ADD "ringNumber" character varying(60)`);
    await q.query(`ALTER TABLE "seller_product_sku" ADD "hatchDate" date`);
    await q.query(`ALTER TABLE "seller_product_sku" ADD "vaccineName" character varying(120)`);
    await q.query(`ALTER TABLE "seller_product_sku" ADD "vaccinatedOn" date`);

    await q.query(`
      CREATE TABLE "seller_product_sku_parent" (
        "id" SERIAL NOT NULL,
        "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
        "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "sellerProductSkuId" integer NOT NULL,
        "role" character varying(10) NOT NULL,
        "name" character varying(120),
        "ringNumber" character varying(60),
        "imageUrl" character varying,
        "imagePath" character varying,
        CONSTRAINT "PK_seller_product_sku_parent" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_seller_product_sku_parent_role" UNIQUE ("sellerProductSkuId", "role"),
        CONSTRAINT "CHK_seller_product_sku_parent_role" CHECK ("role" IN ('sire','dam')),
        CONSTRAINT "FK_seller_product_sku_parent_sku" FOREIGN KEY ("sellerProductSkuId")
          REFERENCES "seller_product_sku"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "IDX_seller_product_sku_parent_sku" ON "seller_product_sku_parent" ("sellerProductSkuId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "seller_product_sku_parent"`);
    for (const c of ['ringNumber', 'hatchDate', 'vaccineName', 'vaccinatedOn']) {
      await q.query(`ALTER TABLE "seller_product_sku" DROP COLUMN "${c}"`);
    }
    for (const c of ['breed', 'bloodline', 'bloodlineNote', 'vaccinationNote', 'healthNote', 'raceRecord']) {
      await q.query(`ALTER TABLE "seller_product" DROP COLUMN "${c}"`);
    }
  }
}
