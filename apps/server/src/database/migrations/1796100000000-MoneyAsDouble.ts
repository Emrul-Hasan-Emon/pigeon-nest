import { MigrationInterface, QueryRunner } from 'typeorm';

// Every money column (and the seller commission rate) becomes double precision.
const COLUMNS: Array<[string, string, string]> = [
  ['cart', 'totalDiscountedPrice', 'numeric(12,2)'],
  ['cart', 'totalPrice', 'numeric(12,2)'],
  ['cart_item', 'totalDiscountedPrice', 'numeric(12,2)'],
  ['cart_item', 'totalPrice', 'numeric(12,2)'],
  ['cart_item', 'unitDiscountedPrice', 'numeric(12,2)'],
  ['cart_item', 'unitPrice', 'numeric(12,2)'],
  ['coupon', 'amount', 'numeric(12,2)'],
  ['coupon', 'maxDiscountAmount', 'numeric(12,2)'],
  ['coupon', 'minOrderAmount', 'numeric(12,2)'],
  ['coupon_history_log', 'discountAmount', 'numeric(12,2)'],
  ['coupon_history_log', 'orderTotal', 'numeric(12,2)'],
  ['order', 'amountPaid', 'numeric(12,2)'],
  ['order', 'deliveryCharge', 'numeric(12,2)'],
  ['order', 'discountAmount', 'numeric(12,2)'],
  ['order', 'payableAmount', 'numeric(12,2)'],
  ['order', 'subtotal', 'numeric(12,2)'],
  ['order', 'total', 'numeric(12,2)'],
  ['order_item', 'totalDiscountedPrice', 'numeric(12,2)'],
  ['order_item', 'totalPrice', 'numeric(12,2)'],
  ['order_item', 'unitDiscountedPrice', 'numeric(12,2)'],
  ['order_item', 'unitPrice', 'numeric(12,2)'],
  ['order_return', 'refundAmount', 'numeric(12,2)'],
  ['payment', 'amount', 'numeric(12,2)'],
  ['payment_status_history', 'amount', 'numeric(12,2)'],
  ['payment_status_history', 'amountPaidAfter', 'numeric(12,2)'],
  ['seller', 'commissionRate', 'numeric(5,2)'],
  ['seller_payout', 'commissionAmount', 'numeric(12,2)'],
  ['seller_payout', 'grossAmount', 'numeric(12,2)'],
  ['seller_payout', 'netAmount', 'numeric(12,2)'],
  ['seller_product_sku', 'discountValue', 'numeric(12,2)'],
  ['seller_product_sku', 'discountedPrice', 'numeric(12,2)'],
  ['seller_product_sku', 'myBuyingPrice', 'numeric(12,2)'],
  ['seller_product_sku', 'price', 'numeric(12,2)'],
  ['shipping_zone', 'charge', 'numeric(10,2)'],
];

export class MoneyAsDouble1796100000000 implements MigrationInterface {
  name = 'MoneyAsDouble1796100000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const [table, col] of COLUMNS) {
      await q.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${col}" TYPE double precision USING "${col}"::double precision`,
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const [table, col, type] of COLUMNS) {
      await q.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${col}" TYPE ${type} USING round("${col}"::numeric, 2)`,
      );
    }
  }
}
