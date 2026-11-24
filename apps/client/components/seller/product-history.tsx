'use client';

import { useCallback, useEffect, useState } from 'react';
import { listSellerProductStatusHistory } from '@/lib/api/products';
import { formatDateTime } from '@/lib/datetime';
import type { ProductStatusHistoryEntry } from '@/types/product';

const STATUS_WORDS: Record<string, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  active: 'Switched on',
  inactive: 'Switched off',
  suspended: 'Suspended',
};
const word = (v: string) => STATUS_WORDS[v] ?? v;

/** One history row said in plain words: what happened. */
function headline(e: ProductStatusHistoryEntry) {
  switch (e.action) {
    case 'baseline':
      return 'Where this product started';
    case 'seller_created':
      return 'You added this product';
    case 'admin_created':
      return 'The admin team added this product';
    case 'seller_updated':
      return 'You changed this product';
    default:
      return e.creatorType === 'admin' ? 'The admin team changed this product' : 'This product was changed';
  }
}

function Change({ label, from, to }: { label: string; from: string | null; to: string }) {
  if (from === to) return null;
  return (
    <p className="text-base text-foreground">
      <span className="text-muted-foreground">{label}: </span>
      {from && <span>{word(from)} → </span>}
      <span className="font-semibold">{word(to)}</span>
    </p>
  );
}

/** Everything that has happened to the product's approval and on/off state, newest first. */
export function SellerProductHistory({ productId }: { productId: number }) {
  const [rows, setRows] = useState<ProductStatusHistoryEntry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    listSellerProductStatusHistory(productId, { limit: 10 })
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
      const r = await listSellerProductStatusHistory(productId, { cursor: next, limit: 10 });
      setRows((c) => [...c, ...r.results]);
      setNext(r.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setMoreBusy(false);
    }
  }, [productId, next]);

  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className="mb-3 font-[family-name:var(--font-serif)] text-2xl font-medium tracking-tight text-foreground">
        Product history
      </h2>
      <div className="rounded-xl border border-border bg-card p-6">
        {failed && (
          <p role="alert" className="mb-3 text-base text-destructive">
            Could not load the history.
          </p>
        )}
        {loading ? (
          <p className="py-6 text-center text-base text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-base text-muted-foreground">Nothing has changed yet.</p>
        ) : (
          <ol className="space-y-5 border-l-2 border-border pl-5">
            {rows.map((e) => {
              const same = e.fromStatus === e.toStatus && e.fromActiveStatus === e.toActiveStatus;
              return (
                <li key={e.id} className="relative">
                  <span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                  <p className="text-lg font-semibold text-foreground">{headline(e)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                    {e.creatorName ? ` · ${e.creatorName}` : ''}
                  </p>
                  <div className="mt-1">
                    {e.fromStatus !== null && <Change label="Approval" from={e.fromStatus} to={e.toStatus} />}
                    {e.fromStatus !== null && <Change label="Shown to customers" from={e.fromActiveStatus} to={e.toActiveStatus} />}
                    {(same || e.fromStatus === null) && (
                      <p className="text-base text-foreground">
                        {same && e.fromStatus !== null ? 'Stayed: ' : 'Status: '}
                        <span className="font-semibold">{word(e.toStatus)}</span> · <span className="font-semibold">{word(e.toActiveStatus)}</span>
                      </p>
                    )}
                  </div>
                  {e.reason && (
                    <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-base text-foreground">
                      <span className="font-medium">Reason: </span>
                      {e.reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {!loading && next !== null && (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={more} disabled={moreBusy} className="rounded-full border border-border px-6 py-2 text-base font-medium text-foreground hover:bg-muted disabled:opacity-60">
              {moreBusy ? 'Loading…' : 'Show older changes'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
