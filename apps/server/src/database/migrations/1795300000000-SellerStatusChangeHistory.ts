import { MigrationInterface, QueryRunner } from 'typeorm';

export class SellerStatusChangeHistory1795300000000
  implements MigrationInterface
{
  name = 'SellerStatusChangeHistory1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "seller_status_change_history" (
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
        "sellerId" integer NOT NULL,
        "fromStatus" character varying,
        "toStatus" character varying NOT NULL,
        "fromActiveStatus" character varying,
        "toActiveStatus" character varying NOT NULL,
        "action" character varying NOT NULL,
        "reason" text,
        CONSTRAINT "PK_seller_status_change_history" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_seller_status_change_history_sellerId" ON "seller_status_change_history" ("sellerId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_status_change_history" ADD CONSTRAINT "FK_seller_status_change_history_sellerId" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Give sellers that already exist a starting entry so every timeline is complete.
    await queryRunner.query(
      `INSERT INTO "seller_status_change_history"
        ("creatorName", "sellerId", "fromStatus", "toStatus", "fromActiveStatus", "toActiveStatus", "action", "reason")
       SELECT 'System', "id", NULL, "status", NULL, "activeStatus", 'baseline',
              'Status when history tracking started'
       FROM "seller"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "seller_status_change_history"`);
  }
}
