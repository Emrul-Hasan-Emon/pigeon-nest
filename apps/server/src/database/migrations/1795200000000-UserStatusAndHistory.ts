import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStatusAndHistory1795200000000 implements MigrationInterface {
  name = 'UserStatusAndHistory1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "status" character varying NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "suspensionReason" text`);
    await queryRunner.query(
      `UPDATE "user" SET "status" = CASE WHEN "isActive" THEN 'active' ELSE 'suspended' END`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isActive"`);

    await queryRunner.query(
      `CREATE TABLE "user_status_change_history" (
        "id" SERIAL NOT NULL,
        "createdBy" integer,
        "creatorType" character varying,
        "creatorName" character varying,
        "updatedBy" integer,
        "updaterType" character varying,
        "updaterName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "userId" integer NOT NULL,
        "fromStatus" character varying,
        "toStatus" character varying NOT NULL,
        "reason" text,
        CONSTRAINT "PK_user_status_change_history" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_status_change_history_userId" ON "user_status_change_history" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_status_change_history" ADD CONSTRAINT "FK_user_status_change_history_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Give users that already exist a starting entry so every timeline is complete.
    await queryRunner.query(
      `INSERT INTO "user_status_change_history" ("userId", "fromStatus", "toStatus", "reason")
       SELECT "id", NULL, "status", 'Initial status (migrated)' FROM "user"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_status_change_history"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "user" SET "isActive" = ("status" = 'active')`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "suspensionReason"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "status"`);
  }
}
