import { MigrationInterface, QueryRunner } from 'typeorm';

// Price proposals: a buyer's private price for one SKU, negotiated with the
// seller (with a history of every step), and the proposal price on cart and
// order lines.
export class SkuPriceProposals1796500000000 implements MigrationInterface {
  name = 'SkuPriceProposals1796500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "sku_price_proposal" ("id" SERIAL NOT NULL, "createdBy" integer, "creatorType" character varying, "creatorName" character varying, "updatedBy" integer, "updaterType" character varying, "updaterName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "sellerId" integer NOT NULL, "sellerProductId" integer NOT NULL, "sellerProductSkuId" integer NOT NULL, "quantity" integer NOT NULL, "price" double precision NOT NULL, "skuPriceAtCreate" double precision NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "awaitingParty" character varying(10), "closedByType" character varying, "closedById" integer, "closeNote" character varying(500), "acceptedAt" TIMESTAMP WITH TIME ZONE, "usedAt" TIMESTAMP WITH TIME ZONE, "orderId" integer, CONSTRAINT "CHK_sku_price_proposal_quantity" CHECK ("quantity" > 0), CONSTRAINT "CHK_sku_price_proposal_price" CHECK ("price" > 0), CONSTRAINT "PK_673f6fecaa93f09685e29ab4787" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_c89d1f8c9523c8c8013d8c8c2d" ON "sku_price_proposal" ("sellerProductId")`);
    await q.query(`CREATE INDEX "IDX_495d0e15a8508da436325c74ef" ON "sku_price_proposal" ("sellerProductSkuId")`);
    await q.query(`CREATE INDEX "IDX_sku_price_proposal_user_status" ON "sku_price_proposal" ("userId", "status")`);
    await q.query(`CREATE INDEX "IDX_sku_price_proposal_seller_status" ON "sku_price_proposal" ("sellerId", "status")`);
    await q.query(`CREATE UNIQUE INDEX "UQ_sku_price_proposal_open" ON "sku_price_proposal" ("userId", "sellerProductSkuId") WHERE "deletedAt" IS NULL AND "status" IN ('pending', 'accepted')`);

    await q.query(`CREATE TABLE "sku_price_proposal_history" ("id" SERIAL NOT NULL, "createdBy" integer, "creatorType" character varying, "creatorName" character varying, "updatedBy" integer, "updaterType" character varying, "updaterName" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "proposalId" integer NOT NULL, "action" character varying(20) NOT NULL, "actorType" character varying(20) NOT NULL, "actorId" integer, "actorName" character varying, "price" double precision NOT NULL, "quantity" integer NOT NULL, "skuPriceAtTime" double precision NOT NULL, "note" character varying(500), CONSTRAINT "PK_e348e45d6f7403806f4e84159f8" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_de32390de2e97ccc22bc03fdd3" ON "sku_price_proposal_history" ("proposalId")`);

    await q.query(`ALTER TABLE "seller_product_sku" ADD "acceptProposals" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "seller_product_sku" ADD "minProposalPrice" double precision`);
    await q.query(`ALTER TABLE "order_item" ADD "proposalId" integer`);
    await q.query(`ALTER TABLE "order_item" ADD "unitProposalPrice" double precision`);
    await q.query(`ALTER TABLE "order_item" ADD "totalProposalPrice" double precision`);
    await q.query(`ALTER TABLE "cart_item" ADD "proposalId" integer`);
    await q.query(`ALTER TABLE "cart_item" ADD "unitProposalPrice" double precision`);
    await q.query(`ALTER TABLE "cart_item" ADD "totalProposalPrice" double precision`);

    await q.query(`ALTER TABLE "sku_price_proposal" ADD CONSTRAINT "FK_5b25e25a6689558361e3ed858c4" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "sku_price_proposal" ADD CONSTRAINT "FK_c151ee59f08581255ea8174680c" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "sku_price_proposal" ADD CONSTRAINT "FK_c89d1f8c9523c8c8013d8c8c2d8" FOREIGN KEY ("sellerProductId") REFERENCES "seller_product"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "sku_price_proposal" ADD CONSTRAINT "FK_495d0e15a8508da436325c74ef1" FOREIGN KEY ("sellerProductSkuId") REFERENCES "seller_product_sku"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "sku_price_proposal" ADD CONSTRAINT "FK_cced662cea9576b81db2e54906f" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "sku_price_proposal_history" ADD CONSTRAINT "FK_de32390de2e97ccc22bc03fdd3b" FOREIGN KEY ("proposalId") REFERENCES "sku_price_proposal"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "order_item" ADD CONSTRAINT "FK_08f12c730de199ada80d78c7350" FOREIGN KEY ("proposalId") REFERENCES "sku_price_proposal"("id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "cart_item" ADD CONSTRAINT "FK_97e2d7be0bca75f98cc5764aeba" FOREIGN KEY ("proposalId") REFERENCES "sku_price_proposal"("id") ON DELETE SET NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "cart_item" DROP CONSTRAINT "FK_97e2d7be0bca75f98cc5764aeba"`);
    await q.query(`ALTER TABLE "order_item" DROP CONSTRAINT "FK_08f12c730de199ada80d78c7350"`);
    await q.query(`ALTER TABLE "cart_item" DROP COLUMN "totalProposalPrice"`);
    await q.query(`ALTER TABLE "cart_item" DROP COLUMN "unitProposalPrice"`);
    await q.query(`ALTER TABLE "cart_item" DROP COLUMN "proposalId"`);
    await q.query(`ALTER TABLE "order_item" DROP COLUMN "totalProposalPrice"`);
    await q.query(`ALTER TABLE "order_item" DROP COLUMN "unitProposalPrice"`);
    await q.query(`ALTER TABLE "order_item" DROP COLUMN "proposalId"`);
    await q.query(`ALTER TABLE "seller_product_sku" DROP COLUMN "minProposalPrice"`);
    await q.query(`ALTER TABLE "seller_product_sku" DROP COLUMN "acceptProposals"`);
    await q.query(`DROP TABLE "sku_price_proposal_history"`);
    await q.query(`DROP TABLE "sku_price_proposal"`);
  }
}
