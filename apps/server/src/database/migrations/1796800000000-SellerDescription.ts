import { MigrationInterface, QueryRunner } from 'typeorm';

// A short "about the seller" text shown on the public seller page.
export class SellerDescription1796800000000 implements MigrationInterface {
  name = 'SellerDescription1796800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller" ADD "description" text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller" DROP COLUMN "description"`);
  }
}
