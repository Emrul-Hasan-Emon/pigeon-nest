import { EntityManager } from 'typeorm';
import { StockMovement } from '../../database/entities/product/stock-movement.entity';
import { StockReason } from '../../database/enums/stock-movement.enum';
import { Actor } from '../types/actor.type';

/** Who made the change. The id is empty for a walk-in order a staff member typed in. */
export type StockActor = Omit<Actor, 'id'> & { id: number | null };

export interface StockChange {
  skuId: number;
  change: number;
  reason: StockReason;
  orderId?: number | null;
  note?: string | null;
}

/**
 * Writes one history row per stock change. Call it right after the quantity was changed, inside the same
 * transaction: it reads the quantity the option has now, and the product, seller and name of the option.
 * A row that changed nothing (change 0) is skipped.
 */
export async function recordStockMovements(manager: EntityManager, changes: StockChange[], actor: StockActor | null): Promise<void> {
  const rows = changes.filter((c) => c.change !== 0);
  if (rows.length === 0) return;
  const info: { id: number; pid: number; sellerId: number; quantity: number; label: string }[] = await manager.query(
    `select k.id, k."sellerProductId" pid, p."sellerId", k.quantity,
            coalesce(nullif(k.sku, ''), nullif(k.description, ''), 'Option ' || k.id) label
       from seller_product_sku k join seller_product p on p.id = k."sellerProductId"
      where k.id = any($1::int[])`,
    [[...new Set(rows.map((r) => r.skuId))]],
  );
  const byId = new Map(info.map((i) => [i.id, i]));
  const entries = rows
    .filter((r) => byId.has(r.skuId))
    .map((r) => {
      const i = byId.get(r.skuId)!;
      return {
        sellerProductId: i.pid,
        sellerProductSkuId: i.id,
        sellerId: i.sellerId,
        skuLabel: i.label.slice(0, 200),
        change: r.change,
        quantityAfter: i.quantity,
        reason: r.reason,
        orderId: r.orderId ?? null,
        note: r.note ?? null,
        createdBy: actor?.id ?? null,
        creatorType: actor?.type ?? null,
        creatorName: actor?.name ?? null,
      };
    });
  if (entries.length > 0) await manager.insert(StockMovement, entries);
}
