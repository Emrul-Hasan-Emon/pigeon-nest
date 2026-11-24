import { MigrationInterface, QueryRunner } from 'typeorm';

// Where buyers pay each seller (bank and mobile money accounts), and "I have paid" claims buyers send after ordering.
export class PaymentAccountsAndClaims1797300000000 implements MigrationInterface {
  name = 'PaymentAccountsAndClaims1797300000000';

  public async up(q: QueryRunner): Promise<void> {
    const base = `
        "id" SERIAL NOT NULL,
        "createdBy" integer, "creatorType" character varying, "creatorName" character varying,
        "updatedBy" integer, "updaterType" character varying, "updaterName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,`;
    await q.query(`
      CREATE TABLE "seller_payment_account" (${base}
        "sellerId" integer NOT NULL,
        "kind" character varying(10) NOT NULL,
        "provider" character varying(80) NOT NULL,
        "accountName" character varying(120),
        "accountNumber" character varying(60) NOT NULL,
        "branchName" character varying(120),
        "note" character varying(200),
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_seller_payment_account" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_seller_payment_account_kind" CHECK ("kind" IN ('mfs','bank')),
        CONSTRAINT "FK_seller_payment_account_seller" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "IDX_seller_payment_account_seller" ON "seller_payment_account" ("sellerId")`);
    await q.query(`
      CREATE TABLE "payment_claim" (${base}
        "orderId" integer NOT NULL,
        "sellerId" integer NOT NULL,
        "userId" integer NOT NULL,
        "amount" double precision NOT NULL,
        "transactionId" character varying(120),
        "method" character varying(60),
        "senderNumber" character varying(40),
        "paidOn" date,
        "note" text,
        "attachments" jsonb NOT NULL DEFAULT '[]',
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "decisionNote" text,
        "decidedAt" TIMESTAMPTZ,
        "decidedByName" character varying(120),
        "paymentId" integer,
        CONSTRAINT "PK_payment_claim" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_payment_claim_status" CHECK ("status" IN ('pending','confirmed','rejected','cancelled')),
        CONSTRAINT "FK_payment_claim_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payment_claim_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )`);
    await q.query(`CREATE INDEX "IDX_payment_claim_order" ON "payment_claim" ("orderId")`);
    await q.query(`CREATE INDEX "IDX_payment_claim_seller_status" ON "payment_claim" ("sellerId", "status")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "payment_claim"`);
    await q.query(`DROP TABLE "seller_payment_account"`);
  }
}
