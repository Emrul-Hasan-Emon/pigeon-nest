import { MigrationInterface, QueryRunner } from 'typeorm';

// A customer (or guest) can hold one active cart per seller. Placing an order
// turns that cart inactive instead of deleting it, and the cart and the order
// point at each other so it is always clear which order a cart became.
export class CartActiveAndOrderLink1795700000000 implements MigrationInterface {
  name = 'CartActiveAndOrderLink1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cart" ADD "isActive" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "cart" ADD "orderId" integer`);
    await queryRunner.query(`ALTER TABLE "order" ADD "cartId" integer`);
    await queryRunner.query(`CREATE INDEX "IDX_cart_isActive" ON "cart" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_cart_orderId" ON "cart" ("orderId")`);
    await queryRunner.query(`CREATE INDEX "IDX_order_cartId" ON "order" ("cartId")`);
    await queryRunner.query(
      `ALTER TABLE "cart" ADD CONSTRAINT "FK_cart_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "FK_order_cartId" FOREIGN KEY ("cartId") REFERENCES "cart"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // At most one active cart per owner and seller, even under concurrent adds.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_cart_active_user_seller" ON "cart" ("userId", "sellerId") WHERE "isActive" = true AND "userId" IS NOT NULL AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_cart_active_session_seller" ON "cart" ("sessionId", "sellerId") WHERE "isActive" = true AND "sessionId" IS NOT NULL AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_cart_item_cart_sku" ON "cart_item" ("cartId", "sellerProductSkuId") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_cart_item_cart_sku"`);
    await queryRunner.query(`DROP INDEX "UQ_cart_active_session_seller"`);
    await queryRunner.query(`DROP INDEX "UQ_cart_active_user_seller"`);
    await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_order_cartId"`);
    await queryRunner.query(`ALTER TABLE "cart" DROP CONSTRAINT "FK_cart_orderId"`);
    await queryRunner.query(`DROP INDEX "IDX_order_cartId"`);
    await queryRunner.query(`DROP INDEX "IDX_cart_orderId"`);
    await queryRunner.query(`DROP INDEX "IDX_cart_isActive"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "cartId"`);
    await queryRunner.query(`ALTER TABLE "cart" DROP COLUMN "orderId"`);
    await queryRunner.query(`ALTER TABLE "cart" DROP COLUMN "isActive"`);
  }
}
