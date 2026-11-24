import { MigrationInterface, QueryRunner } from 'typeorm';

// A seller may list several products with the same name, so a name (slug) no longer has to be unique per seller.
export class AllowSameProductName1797700000000 implements MigrationInterface {
  name = 'AllowSameProductName1797700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller_product" DROP CONSTRAINT "UQ_094c72b04fdedbee23e63db6ca2"`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller_product" ADD CONSTRAINT "UQ_094c72b04fdedbee23e63db6ca2" UNIQUE ("sellerId", "slug")`);
  }
}
