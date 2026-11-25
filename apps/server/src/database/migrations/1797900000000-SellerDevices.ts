import { MigrationInterface, QueryRunner } from 'typeorm';

// The phones that have the seller app signed in, for push notifications.
export class SellerDevices1797900000000 implements MigrationInterface {
  name = 'SellerDevices1797900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "seller_device" (
      "id" SERIAL NOT NULL,
      "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
      "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP,
      "sellerId" integer NOT NULL,
      "token" character varying(512) NOT NULL,
      "platform" character varying(10) NOT NULL,
      "lastSeenAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_seller_device" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_seller_device_platform" CHECK ("platform" IN ('android','ios')),
      CONSTRAINT "FK_seller_device_seller" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX "IDX_seller_device_seller" ON "seller_device" ("sellerId")`);
    await q.query(`CREATE UNIQUE INDEX "UQ_seller_device_token" ON "seller_device" ("token")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "seller_device"`);
  }
}
