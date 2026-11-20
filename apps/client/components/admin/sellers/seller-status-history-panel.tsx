'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatusHistoryTable } from '@/components/admin/sellers/status-history-table';
import { listSellerStatusHistory } from '@/lib/api/sellers';
import type { SellerStatusHistoryEntry } from '@/types/seller';

const PAGE_SIZE = 10;

/** One seller's status log (newest first, cursor paged), shown on the seller details page. */
export function SellerStatusHistoryPanel({ sellerId }: { sellerId: number }) {
  const [entries, setEntries] = useState<SellerStatusHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadFirst = useCallback(async () => {
    try {
      const response = await listSellerStatusHistory({ sellerId, limit: PAGE_SIZE });
      setEntries(response.results);
      setNextCursor(response.nextCursor);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirst();
  }, [loadFirst]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listSellerStatusHistory({
        sellerId,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setEntries((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="mt-8 max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Status history</h2>
      {failed && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Failed to load the status history.
        </p>
      )}
      {loading ? (
        <p className="py-6 text-center text-muted-foreground">Loading…</p>
      ) : (
        <StatusHistoryTable entries={entries} showSeller={false} />
      )}
      {!loading && nextCursor !== null && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  );
}
