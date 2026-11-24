import { MigrationInterface, QueryRunner } from 'typeorm';

// A shop break: a seller hides all their products for a while without switching each one off.
export class SellerVacation1797100000000 implements MigrationInterface {
  name = 'SellerVacation1797100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller" ADD "onVacation" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "seller" ADD "vacationUntil" date`);
    await q.query(`ALTER TABLE "seller" ADD "vacationNote" character varying(300)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "seller" DROP COLUMN "vacationNote"`);
    await q.query(`ALTER TABLE "seller" DROP COLUMN "vacationUntil"`);
    await q.query(`ALTER TABLE "seller" DROP COLUMN "onVacation"`);
  }
}
