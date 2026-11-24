import { MigrationInterface, QueryRunner } from 'typeorm';

// A buyer may send only one "mark as paid" request for an order, whatever happens to it.
export class OneClaimPerOrder1797500000000 implements MigrationInterface {
  name = 'OneClaimPerOrder1797500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE UNIQUE INDEX "UQ_payment_claim_order" ON "payment_claim" ("orderId") WHERE "deletedAt" IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "UQ_payment_claim_order"`);
  }
}
