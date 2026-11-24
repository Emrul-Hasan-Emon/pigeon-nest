'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { listStockHistory } from '@/lib/api/products';
import { formatDateTime } from '@/lib/datetime';
import type { StockMovement, StockReason } from '@/types/product';

const PAGE_SIZE = 10;

const REASON: Record<StockReason, string> = {
  initial: 'Starting stock',
  edited: 'Changed by hand',
  order_placed: 'Sold in an order',
  order_cancelled: 'Order cancelled, stock put back',
  order_reopened: 'Order reopened, stock taken again',
};

/** Every change to the stock of this product's options, newest first, ten at a time. Admin only. */
export function StockHistoryPanel({ productId }: { productId: number }) {
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    listStockHistory(productId, { limit: PAGE_SIZE })
      .then((r) => {
        if (!live) return;
        setRows(r.results);
        setNext(r.nextCursor);
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [productId]);

  const more = useCallback(async () => {
    if (next === null) return;
    setMoreBusy(true);
    try {
      const r = await listStockHistory(productId, { cursor: next, limit: PAGE_SIZE });
      setRows((c) => [...c, ...r.results]);
      setNext(r.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setMoreBusy(false);
    }
  }, [productId, next]);

  const base = '/admin';

  return (
    <section aria-labelledby="stock-history-title">
      <h2 id="stock-history-title" className="mb-3 font-[family-name:var(--font-serif)] text-2xl font-medium tracking-tight text-foreground">
        Stock history
      </h2>
      <div className="rounded-xl border border-border bg-card p-4">
        {failed && <p role="alert" className="mb-3 text-base text-destructive">Could not load the stock history.</p>}
        {loading ? (
          <p className="py-6 text-center text-base text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-base text-muted-foreground">No stock changes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-base">
              <thead>
                <tr className="border-b border-border text-left text-sm">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Option</th>
                  <th className="px-3 py-2 text-right">Change</th>
                  <th className="px-3 py-2 text-right">Stock after</th>
                  <th className="px-3 py-2">Why</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-b-0 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(m.createdAt)}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{m.sku.label}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${m.change > 0 ? 'text-emerald-700' : 'text-destructive'}`}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.quantityAfter}</td>
                    <td className="px-3 py-2">
                      <span className="block text-foreground">{REASON[m.reason]}</span>
                      {m.orderId ? (
                        <Link href={`${base}/orders/${m.orderId}`} className="text-sm text-primary hover:underline">{m.note ?? `Order #${m.orderId}`}</Link>
                      ) : (
                        m.note && <span className="block text-sm text-muted-foreground">{m.note}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{m.by ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && next !== null && (
          <div className="mt-3 flex justify-center">
            <button type="button" onClick={more} disabled={moreBusy} className="rounded-full border border-border px-6 py-2 text-base font-medium hover:bg-muted disabled:opacity-60">
              {moreBusy ? 'Loading…' : 'Show older changes'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
