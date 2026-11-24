import { MigrationInterface, QueryRunner } from 'typeorm';

// The shop break becomes a selling switch: `isEnabledForSell` (on by default) plus an optional planned break with a
// start and an end date. When selling is off, or today falls inside the planned break, the seller is hidden everywhere.
export class SellerSellingSwitch1797400000000 implements MigrationInterface {
  name = 'SellerSellingSwitch1797400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller" ADD "isEnabledForSell" boolean NOT NULL DEFAULT true`);
    await q.query(`UPDATE "seller" SET "isEnabledForSell" = NOT "onVacation"`);
    await q.query(`ALTER TABLE "seller" RENAME COLUMN "vacationUntil" TO "breakEndsOn"`);
    await q.query(`ALTER TABLE "seller" RENAME COLUMN "vacationNote" TO "breakNote"`);
    await q.query(`ALTER TABLE "seller" ADD "breakStartsOn" date`);
    await q.query(`ALTER TABLE "seller" DROP COLUMN "onVacation"`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller" ADD "onVacation" boolean NOT NULL DEFAULT false`);
    await q.query(`UPDATE "seller" SET "onVacation" = NOT "isEnabledForSell"`);
    await q.query(`ALTER TABLE "seller" DROP COLUMN "breakStartsOn"`);
    await q.query(`ALTER TABLE "seller" RENAME COLUMN "breakNote" TO "vacationNote"`);
    await q.query(`ALTER TABLE "seller" RENAME COLUMN "breakEndsOn" TO "vacationUntil"`);
    await q.query(`ALTER TABLE "seller" DROP COLUMN "isEnabledForSell"`);
  }
}
