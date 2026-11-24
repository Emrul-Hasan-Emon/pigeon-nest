import { MigrationInterface, QueryRunner } from 'typeorm';

// A reason group for every return, so a report can count why birds come back. Older returns count as "other".
export class ReturnReasonCode1796900000000 implements MigrationInterface {
  name = 'ReturnReasonCode1796900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "order_return" ADD "reasonCode" character varying(30) NOT NULL DEFAULT 'other'`);
    await q.query(
      `ALTER TABLE "order_return" ADD CONSTRAINT "CHK_order_return_reasonCode" CHECK ("reasonCode" IN ('not_as_described','sick_or_injured','wrong_bird','damaged_in_transit','late_delivery','changed_mind','other'))`,
    );
    await q.query(`CREATE INDEX "IDX_order_return_reasonCode" ON "order_return" ("reasonCode")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_order_return_reasonCode"`);
    await q.query(`ALTER TABLE "order_return" DROP CONSTRAINT "CHK_order_return_reasonCode"`);
    await q.query(`ALTER TABLE "order_return" DROP COLUMN "reasonCode"`);
  }
}
