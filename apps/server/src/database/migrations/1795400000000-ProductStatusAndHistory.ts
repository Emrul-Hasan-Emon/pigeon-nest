import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductStatusAndHistory1795400000000 implements MigrationInterface {
  name = 'ProductStatusAndHistory1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seller_product" ADD "status" character varying NOT NULL DEFAULT 'approved'`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" ADD "activeStatus" character varying NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" ADD "rejectionReason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" ADD "suspensionReason" text`,
    );
    await queryRunner.query(
      `UPDATE "seller_product" SET "activeStatus" = CASE WHEN "isActive" THEN 'active' ELSE 'inactive' END`,
    );
    // Visibility is now derived: approved AND active.
    await queryRunner.query(
      `ALTER TABLE "seller_product" DROP COLUMN "isActive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" DROP COLUMN "isPublished"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_seller_product_status" ON "seller_product" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_seller_product_activeStatus" ON "seller_product" ("activeStatus")`,
    );

    await queryRunner.query(
      `CREATE TABLE "seller_product_status_change_history" (
        "id" SERIAL NOT NULL,
        "createdBy" integer,
        "creatorType" character varying,
        "creatorName" character varying,
        "updatedBy" integer,
        "updaterType" character varying,
        "updaterName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "sellerProductId" integer NOT NULL,
        "fromStatus" character varying,
        "toStatus" character varying NOT NULL,
        "fromActiveStatus" character varying,
        "toActiveStatus" character varying NOT NULL,
        "action" character varying NOT NULL,
        "reason" text,
        CONSTRAINT "PK_seller_product_status_change_history" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_seller_product_status_change_history_productId" ON "seller_product_status_change_history" ("sellerProductId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product_status_change_history" ADD CONSTRAINT "FK_seller_product_status_change_history_productId" FOREIGN KEY ("sellerProductId") REFERENCES "seller_product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Starting entry for products that already exist.
    await queryRunner.query(
      `INSERT INTO "seller_product_status_change_history"
        ("creatorName", "sellerProductId", "fromStatus", "toStatus", "fromActiveStatus", "toActiveStatus", "action", "reason")
       SELECT 'System', "id", NULL, "status", NULL, "activeStatus", 'baseline',
              'Status when history tracking started'
       FROM "seller_product"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE "seller_product_status_change_history"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" ADD "isActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" ADD "isPublished" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "seller_product" SET "isActive" = ("activeStatus" = 'active'),
        "isPublished" = ("status" = 'approved' AND "activeStatus" = 'active')`,
    );
    await queryRunner.query(`DROP INDEX "IDX_seller_product_activeStatus"`);
    await queryRunner.query(`DROP INDEX "IDX_seller_product_status"`);
    await queryRunner.query(
      `ALTER TABLE "seller_product" DROP COLUMN "suspensionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" DROP COLUMN "rejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" DROP COLUMN "activeStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_product" DROP COLUMN "status"`,
    );
  }
}
