import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerNidImages1794582939515 implements MigrationInterface {
  name = 'AddSellerNidImages1794582939515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seller" ADD "nidFrontImageUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller" ADD "nidFrontImagePath" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller" ADD "nidBackImageUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller" ADD "nidBackImagePath" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "nidBackImagePath"`);
    await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "nidBackImageUrl"`);
    await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "nidFrontImagePath"`);
    await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "nidFrontImageUrl"`);
  }
}
