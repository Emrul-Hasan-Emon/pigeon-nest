import { MigrationInterface, QueryRunner } from 'typeorm';

export class SellerActiveStatus1795100000000 implements MigrationInterface {
  name = 'SellerActiveStatus1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seller" ADD "activeStatus" character varying NOT NULL DEFAULT 'inactive'`,
    );
    await queryRunner.query(
      `UPDATE "seller" SET "activeStatus" = CASE WHEN "isActive" THEN 'active' ELSE 'inactive' END`,
    );
    await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "isActive"`);
    await queryRunner.query(`ALTER TABLE "seller" ADD "rejectionReason" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "rejectionReason"`);
    await queryRunner.query(
      `ALTER TABLE "seller" ADD "isActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "seller" SET "isActive" = ("activeStatus" = 'active')`,
    );
    await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "activeStatus"`);
  }
}
