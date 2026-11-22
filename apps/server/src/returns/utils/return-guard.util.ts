import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * An order with an open or finished return cannot be cancelled or have its
 * payment reversed: the refund and the commission already depend on it. Finish
 * or cancel the return first.
 */
export async function assertNoLiveReturns(manager: EntityManager, orderId: number, action: string) {
  const rows: { returnNumber: string }[] = await manager.query(
    `SELECT "returnNumber" FROM order_return
      WHERE "orderId" = $1 AND "deletedAt" IS NULL
        AND status IN ('return_requested','accepted','processing','returning_money','returned')
      LIMIT 1`,
    [orderId],
  );
  if (rows.length > 0) {
    throw new ConflictException(
      `${action} is not possible: return ${rows[0].returnNumber} is still open or finished. Cancel or reject it first.`,
    );
  }
}
