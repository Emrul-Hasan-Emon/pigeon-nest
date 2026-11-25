import { MigrationInterface, QueryRunner } from 'typeorm';

// Every table that stores money now says which currency it is in. All current rows are USD.
export class MoneyCurrency1797800000000 implements MigrationInterface {
  name = 'MoneyCurrency1797800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller_product_sku" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "cart" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "cart_item" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "order" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "order_item" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "sku_price_proposal" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "payment" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "payment_claim" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "order_refund" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "order_return" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "system_commission_disburse" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "system_commission_history" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "seller_payout" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
    await q.query(`ALTER TABLE "coupon" ADD "currency" character(3) NOT NULL DEFAULT 'USD'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller_product_sku" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "cart" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "cart_item" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "order" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "order_item" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "sku_price_proposal" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "payment" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "payment_claim" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "order_refund" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "system_commission_disburse" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "system_commission_history" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "seller_payout" DROP COLUMN "currency"`);
    await q.query(`ALTER TABLE "coupon" DROP COLUMN "currency"`);
  }
}
