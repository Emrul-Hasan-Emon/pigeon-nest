'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PRODUCT_ACTION_LABELS, ProductStatusHistoryTable } from '@/components/admin/catalog/products/product-status-history-table';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { listProductStatusHistory } from '@/lib/api/products';
import type {
  ProductActiveStatus,
  ProductStatus,
  ProductStatusChangeAction,
  ProductStatusHistoryEntry,
} from '@/types/product';
import { LoadingBlock } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function ProductStatusHistoryPage() {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [action, setAction] = useState<'all' | ProductStatusChangeAction>('all');
  const [status, setStatus] = useState<'all' | ProductStatus>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | ProductActiveStatus>('all');

  const [entries, setEntries] = useState<ProductStatusHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const filters = useCallback(
    () => ({
      search: debouncedSearch || undefined,
      action: action === 'all' ? undefined : action,
      toStatus: status === 'all' ? undefined : status,
      toActiveStatus: activeStatus === 'all' ? undefined : activeStatus,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, action, status, activeStatus],
  );

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listProductStatusHistory(filters());
      setEntries(response.results);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load the status history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listProductStatusHistory({ ...filters(), cursor: nextCursor });
      setEntries((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load more history.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Product status history</h1>
        <Link href="/admin/catalog/products" className="text-sm text-muted-foreground hover:text-foreground">
          ← All products
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by product or seller name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-72 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <select
          value={action}
          onChange={(event) => setAction(event.target.value as typeof action)}
          className={selectClass}
          aria-label="Event"
        >
          <option value="all">Any event</option>
          {(Object.keys(PRODUCT_ACTION_LABELS) as ProductStatusChangeAction[]).map((key) => (
            <option key={key} value={key}>
              {PRODUCT_ACTION_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className={selectClass}
          aria-label="New status"
        >
          <option value="all">Any new status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={activeStatus}
          onChange={(event) => setActiveStatus(event.target.value as typeof activeStatus)}
          className={selectClass}
          aria-label="New activity"
        >
          <option value="all">Any new activity</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <ProductStatusHistoryTable entries={entries} showProduct />
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-4 flex justify-center">
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
    </div>
  );
}
