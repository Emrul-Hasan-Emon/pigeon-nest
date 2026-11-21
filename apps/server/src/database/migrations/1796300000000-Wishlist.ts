import { MigrationInterface, QueryRunner } from 'typeorm';

// Wishlist: reshape the (empty) table from the first schema, remember the price
// at save time, and keep a running save count on every product.
export class Wishlist1796300000000 implements MigrationInterface {
  name = 'Wishlist1796300000000';

  public async up(q: QueryRunner): Promise<void> {
    // The old table had a stray "productId" column next to "sellerProductId".
    await q.query(`ALTER TABLE "wishlist" DROP CONSTRAINT IF EXISTS "FK_17e00e49d77ccaf7ff0e14de37b"`);
    await q.query(`ALTER TABLE "wishlist" DROP COLUMN IF EXISTS "productId"`);
    await q.query(`ALTER TABLE "wishlist" ADD COLUMN "priceWhenSaved" double precision NOT NULL DEFAULT 0`);
    await q.query(
      `ALTER TABLE "wishlist" ADD CONSTRAINT "FK_f4fb64d0bc3c323e6fde2a026c8" FOREIGN KEY ("sellerProductId") REFERENCES "seller_product"("id") ON DELETE CASCADE`,
    );

    await q.query(`ALTER TABLE "seller_product" ADD COLUMN "wishlistCount" integer NOT NULL DEFAULT 0`);
    await q.query(
      `UPDATE "seller_product" p SET "wishlistCount" = c.n FROM (SELECT "sellerProductId", COUNT(*)::int n FROM "wishlist" GROUP BY 1) c WHERE c."sellerProductId" = p.id`,
    );
    await q.query(
      `ALTER TABLE "seller_product" ADD CONSTRAINT "CHK_seller_product_wishlistCount" CHECK ("wishlistCount" >= 0)`,
    );
    await q.query(`CREATE INDEX "IDX_seller_product_wishlistCount" ON "seller_product" ("wishlistCount")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_seller_product_wishlistCount"`);
    await q.query(`ALTER TABLE "seller_product" DROP CONSTRAINT "CHK_seller_product_wishlistCount"`);
    await q.query(`ALTER TABLE "seller_product" DROP COLUMN "wishlistCount"`);
    await q.query(`ALTER TABLE "wishlist" DROP CONSTRAINT "FK_f4fb64d0bc3c323e6fde2a026c8"`);
    await q.query(`ALTER TABLE "wishlist" DROP COLUMN "priceWhenSaved"`);
    await q.query(`ALTER TABLE "wishlist" ADD COLUMN "productId" integer`);
    await q.query(
      `ALTER TABLE "wishlist" ADD CONSTRAINT "FK_17e00e49d77ccaf7ff0e14de37b" FOREIGN KEY ("productId") REFERENCES "seller_product"("id") ON DELETE CASCADE`,
    );
  }
}
