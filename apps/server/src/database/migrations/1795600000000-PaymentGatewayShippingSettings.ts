import { MigrationInterface, QueryRunner } from 'typeorm';

// Prepares checkout configuration:
//  - payment gateways: long descriptions, manual by default, COD gateway seeded
//  - shipping zones: country-wise (a zone is a list of ISO country codes for one
//    delivery type) instead of one code per zone; the table was never populated
//  - system settings: the global shipping defaults used when no zone matches
export class PaymentGatewayShippingSettings1795600000000
  implements MigrationInterface
{
  name = 'PaymentGatewayShippingSettings1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // payment gateway
    await queryRunner.query(
      `ALTER TABLE "payment_gateway" ALTER COLUMN "description" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_gateway" ALTER COLUMN "isManual" SET DEFAULT true`,
    );
    await queryRunner.query(
      `INSERT INTO "payment_gateway" ("name", "slug", "type", "isManual", "description", "isActive")
       SELECT 'Cash on Delivery', 'cash-on-delivery', 'cod', true,
              'Pay in cash when your order arrives.', true
       WHERE NOT EXISTS (SELECT 1 FROM "payment_gateway" WHERE "slug" = 'cash-on-delivery')`,
    );

    // shipping zone
    await queryRunner.query(
      `ALTER TABLE "shipping_zone" DROP CONSTRAINT "UQ_be1c1b03903c10a7bbc0aeac2e6"`,
    );
    await queryRunner.query(`ALTER TABLE "shipping_zone" DROP COLUMN "code"`);
    await queryRunner.query(
      `ALTER TABLE "shipping_zone" ADD "deliveryType" character varying(20) NOT NULL DEFAULT 'standard'`,
    );
    await queryRunner.query(
      `ALTER TABLE "shipping_zone" ADD "countryCodes" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shipping_zone_deliveryType" ON "shipping_zone" ("deliveryType")`,
    );

    // global defaults
    await queryRunner.query(
      `INSERT INTO "system_setting" ("key", "value", "description", "group") VALUES
        ('shipping.defaultCharge', '0', 'Delivery charge used when no shipping zone covers the destination', 'shipping'),
        ('shipping.defaultEstimatedDays', '7', 'Estimated delivery days used when no shipping zone covers the destination', 'shipping'),
        ('shipping.defaultSupportsLiveAnimal', 'true', 'Whether live birds can be shipped where no shipping zone covers the destination', 'shipping')
       ON CONFLICT ("key") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "system_setting" WHERE "key" IN ('shipping.defaultCharge','shipping.defaultEstimatedDays','shipping.defaultSupportsLiveAnimal')`,
    );
    await queryRunner.query(`DROP INDEX "IDX_shipping_zone_deliveryType"`);
    await queryRunner.query(`ALTER TABLE "shipping_zone" DROP COLUMN "countryCodes"`);
    await queryRunner.query(`ALTER TABLE "shipping_zone" DROP COLUMN "deliveryType"`);
    await queryRunner.query(`ALTER TABLE "shipping_zone" ADD "code" character varying`);
    await queryRunner.query(`UPDATE "shipping_zone" SET "code" = 'zone-' || "id"`);
    await queryRunner.query(`ALTER TABLE "shipping_zone" ALTER COLUMN "code" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "shipping_zone" ADD CONSTRAINT "UQ_be1c1b03903c10a7bbc0aeac2e6" UNIQUE ("code")`,
    );
    await queryRunner.query(`DELETE FROM "payment_gateway" WHERE "slug" = 'cash-on-delivery' AND "type" = 'cod'`);
    await queryRunner.query(`ALTER TABLE "payment_gateway" ALTER COLUMN "isManual" SET DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "payment_gateway" ALTER COLUMN "description" TYPE character varying`);
  }
}
