import { MigrationInterface, QueryRunner } from 'typeorm';

// Orders for customers worldwide, guests included: the buyer can be a guest
// session, the address is free text with a country, and the status sets are
// the final ones (orders: pending, confirmed, cancelled, packed, shipped,
// delivered; payment: due, paid, partially_paid).
export class OrdersCheckout1795800000000 implements MigrationInterface {
  name = 'OrdersCheckout1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Old status values, in case any rows exist.
    await queryRunner.query(`UPDATE "order" SET "status" = 'packed' WHERE "status" = 'processing'`);
    await queryRunner.query(`UPDATE "order" SET "paymentStatus" = 'due' WHERE "paymentStatus" NOT IN ('paid')`);
    await queryRunner.query(`UPDATE "payment" SET "status" = 'due' WHERE "status" NOT IN ('paid')`);

    // order: guest buyer
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "userId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "order" ADD "guestSessionId" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "order" ADD "contactEmail" character varying(255)`);
    await queryRunner.query(`CREATE INDEX "IDX_order_guestSessionId" ON "order" ("guestSessionId")`);

    // order: gateway name, shipping and address as placed
    await queryRunner.query(`ALTER TABLE "order" ADD "paymentGatewayName" character varying(255) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "paymentGatewayName" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "order" ADD "amountPaid" numeric(12,2) NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "order" ADD "countryCode" character varying(2) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "countryCode" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "order" ADD "countryName" character varying(100) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "countryName" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "order" ADD "state" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "order" ADD "city" character varying(120) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "city" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "order" ADD "deliveryEstimatedDays" integer`);
    await queryRunner.query(`ALTER TABLE "order" ADD "shippingZoneName" character varying(255)`);
    await queryRunner.query(`CREATE INDEX "IDX_order_countryCode" ON "order" ("countryCode")`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "paymentStatus" TYPE character varying`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "paymentStatus" SET DEFAULT 'due'`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "recipientName" TYPE character varying(255)`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "recipientPhone" TYPE character varying(20)`);

    // order status history: where the order came from
    await queryRunner.query(`ALTER TABLE "order_status_history" ADD "fromStatus" character varying`);

    // payment: guest buyer, gateway name, description
    await queryRunner.query(`ALTER TABLE "payment" ADD "userId" integer`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "paymentGatewayName" character varying(255) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "paymentGatewayName" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "status" SET DEFAULT 'due'`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_userId" ON "payment" ("userId")`);
    await queryRunner.query(
      `ALTER TABLE "payment" ADD CONSTRAINT "FK_payment_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_payment_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_payment_userId"`);
    await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "status" SET DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "paymentGatewayName"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "userId"`);

    await queryRunner.query(`ALTER TABLE "order_status_history" DROP COLUMN "fromStatus"`);

    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "recipientPhone" TYPE character varying`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "recipientName" TYPE character varying`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "paymentStatus" TYPE character varying(255)`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "paymentStatus" SET DEFAULT 'pending'`);
    await queryRunner.query(`DROP INDEX "IDX_order_countryCode"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "shippingZoneName"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "deliveryEstimatedDays"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "state"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "countryName"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "countryCode"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "amountPaid"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "paymentGatewayName"`);
    await queryRunner.query(`DROP INDEX "IDX_order_guestSessionId"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "contactEmail"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "guestSessionId"`);
    await queryRunner.query(`DELETE FROM "order" WHERE "userId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "order" ALTER COLUMN "userId" SET NOT NULL`);
    await queryRunner.query(`UPDATE "order" SET "paymentStatus" = 'pending' WHERE "paymentStatus" = 'due'`);
    await queryRunner.query(`UPDATE "payment" SET "status" = 'pending' WHERE "status" = 'due'`);
  }
}
