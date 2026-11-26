import { MigrationInterface, QueryRunner } from 'typeorm';

// The phones that have the buyer app signed in, for push notifications.
export class UserDevices1798000000000 implements MigrationInterface {
  name = 'UserDevices1798000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "user_device" (
      "id" SERIAL NOT NULL,
      "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
      "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP,
      "userId" integer NOT NULL,
      "token" character varying(512) NOT NULL,
      "platform" character varying(10) NOT NULL,
      "lastSeenAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_user_device" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_user_device_platform" CHECK ("platform" IN ('android','ios')),
      CONSTRAINT "FK_user_device_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX "IDX_user_device_user" ON "user_device" ("userId")`);
    await q.query(`CREATE UNIQUE INDEX "UQ_user_device_token" ON "user_device" ("token")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "user_device"`);
  }
}
