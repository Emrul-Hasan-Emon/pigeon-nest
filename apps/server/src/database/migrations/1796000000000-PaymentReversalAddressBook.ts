import { MigrationInterface, QueryRunner } from 'typeorm';

// Payment reversal columns, and the address book reshaped for customers
// worldwide: country, state, city and one free-text address (instead of the
// Bangladesh-only division and district links).
export class PaymentReversalAddressBook1796000000000 implements MigrationInterface {
  name = 'PaymentReversalAddressBook1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment" ADD "reversedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "reversedBy" integer`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "reversedByType" character varying`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "reversedByName" character varying`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "reversalReason" text`);

    await queryRunner.query(`ALTER TABLE "address" DROP CONSTRAINT "FK_78c7b1f439f7cd9867bad169b6e"`);
    await queryRunner.query(`ALTER TABLE "address" DROP CONSTRAINT "FK_89e09cf52a27eec4a04378bbdda"`);
    await queryRunner.query(`DROP INDEX "IDX_78c7b1f439f7cd9867bad169b6"`);
    await queryRunner.query(`DROP INDEX "IDX_89e09cf52a27eec4a04378bbdd"`);
    await queryRunner.query(`ALTER TABLE "address" DROP COLUMN "divisionId"`);
    await queryRunner.query(`ALTER TABLE "address" DROP COLUMN "districtId"`);
    await queryRunner.query(`ALTER TABLE "address" ADD "countryCode" character varying(2) NOT NULL DEFAULT 'BD'`);
    await queryRunner.query(`ALTER TABLE "address" ALTER COLUMN "countryCode" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "address" ADD "state" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "address" ADD "city" character varying(120) NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "address" ALTER COLUMN "city" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "address" ALTER COLUMN "phone" TYPE character varying(20)`);
    await queryRunner.query(`ALTER TABLE "address" ALTER COLUMN "zipCode" TYPE character varying(20)`);
    await queryRunner.query(`ALTER INDEX "IDX_d25f1ea79e282cc8a42bd616aa" RENAME TO "IDX_address_userId"`);
    await queryRunner.query(`ALTER TABLE "address" DROP CONSTRAINT IF EXISTS "FK_d25f1ea79e282cc8a42bd616aa3"`);
    await queryRunner.query(
      `ALTER TABLE "address" ADD CONSTRAINT "FK_address_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // One default address per customer, even under parallel requests.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_address_default_per_user" ON "address" ("userId") WHERE "isDefault" = true AND "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_address_default_per_user"`);
    await queryRunner.query(`ALTER TABLE "address" DROP CONSTRAINT "FK_address_userId"`);
    await queryRunner.query(`ALTER INDEX "IDX_address_userId" RENAME TO "IDX_d25f1ea79e282cc8a42bd616aa"`);
    await queryRunner.query(
      `ALTER TABLE "address" ADD CONSTRAINT "FK_d25f1ea79e282cc8a42bd616aa3" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "address" ALTER COLUMN "zipCode" TYPE character varying`);
    await queryRunner.query(`ALTER TABLE "address" ALTER COLUMN "phone" TYPE character varying`);
    await queryRunner.query(`ALTER TABLE "address" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "address" DROP COLUMN "state"`);
    await queryRunner.query(`ALTER TABLE "address" DROP COLUMN "countryCode"`);
    await queryRunner.query(`ALTER TABLE "address" ADD "districtId" integer`);
    await queryRunner.query(`ALTER TABLE "address" ADD "divisionId" integer`);
    await queryRunner.query(`CREATE INDEX "IDX_89e09cf52a27eec4a04378bbdd" ON "address" ("districtId")`);
    await queryRunner.query(`CREATE INDEX "IDX_78c7b1f439f7cd9867bad169b6" ON "address" ("divisionId")`);
    await queryRunner.query(
      `ALTER TABLE "address" ADD CONSTRAINT "FK_89e09cf52a27eec4a04378bbdda" FOREIGN KEY ("districtId") REFERENCES "district"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "address" ADD CONSTRAINT "FK_78c7b1f439f7cd9867bad169b6e" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "reversalReason"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "reversedByName"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "reversedByType"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "reversedBy"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "reversedAt"`);
  }
}
