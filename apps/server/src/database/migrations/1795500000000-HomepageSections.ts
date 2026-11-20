import { MigrationInterface, QueryRunner } from 'typeorm';

// Reshapes homepage_section into a typed, schedulable section table and seeds
// the fixed homepage slots. The old table was never populated.
export class HomepageSections1795500000000 implements MigrationInterface {
  name = 'HomepageSections1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "homepage_section" DROP CONSTRAINT "UQ_1f08798d0478f693539e7eb0a8e"`,
    );
    await queryRunner.query(`ALTER TABLE "homepage_section" DROP COLUMN "key"`);
    await queryRunner.query(`ALTER TABLE "homepage_section" DROP COLUMN "type"`);
    await queryRunner.query(
      `ALTER TABLE "homepage_section" DROP COLUMN "content"`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "page" character varying NOT NULL DEFAULT 'main'`,
    );
    await queryRunner.query(`ALTER TABLE "homepage_section" ADD "slotNo" integer`);
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "sectionType" character varying NOT NULL DEFAULT 'featured_products'`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ALTER COLUMN "sectionType" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "config" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "layout" character varying NOT NULL DEFAULT 'carousel'`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "deviceVisibility" character varying NOT NULL DEFAULT 'both'`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "startsAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "endsAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_homepage_section_page" ON "homepage_section" ("page")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_homepage_section_page_slot" ON "homepage_section" ("page", "slotNo") WHERE "slotNo" IS NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO "homepage_section" ("page", "slotNo", "title", "sectionType", "config", "sortOrder", "isActive")
       SELECT 'slots', n, 'Slot ' || n, 'featured_products', '{"limit": 10}'::jsonb, n, false
       FROM generate_series(1, 4) AS n`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "homepage_section"`);
    await queryRunner.query(`DROP INDEX "UQ_homepage_section_page_slot"`);
    await queryRunner.query(`DROP INDEX "IDX_homepage_section_page"`);
    await queryRunner.query(`ALTER TABLE "homepage_section" DROP COLUMN "endsAt"`);
    await queryRunner.query(
      `ALTER TABLE "homepage_section" DROP COLUMN "startsAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" DROP COLUMN "deviceVisibility"`,
    );
    await queryRunner.query(`ALTER TABLE "homepage_section" DROP COLUMN "layout"`);
    await queryRunner.query(`ALTER TABLE "homepage_section" DROP COLUMN "config"`);
    await queryRunner.query(
      `ALTER TABLE "homepage_section" DROP COLUMN "sectionType"`,
    );
    await queryRunner.query(`ALTER TABLE "homepage_section" DROP COLUMN "slotNo"`);
    await queryRunner.query(`ALTER TABLE "homepage_section" DROP COLUMN "page"`);
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "content" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "type" character varying(255) NOT NULL DEFAULT 'custom'`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD "key" character varying(255)`,
    );
    await queryRunner.query(`UPDATE "homepage_section" SET "key" = 'section-' || id`);
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ALTER COLUMN "key" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "homepage_section" ADD CONSTRAINT "UQ_1f08798d0478f693539e7eb0a8e" UNIQUE ("key")`,
    );
  }
}
