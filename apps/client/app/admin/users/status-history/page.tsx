'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserStatusHistoryTable } from '@/components/admin/users/status-history-table';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { listUserStatusHistory } from '@/lib/api/users';
import type { UserStatus, UserStatusHistoryEntry } from '@/types/user';
import { LoadingBlock } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function UserStatusHistoryPage() {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [fromStatus, setFromStatus] = useState<'all' | UserStatus>('all');
  const [toStatus, setToStatus] = useState<'all' | UserStatus>('all');

  const [entries, setEntries] = useState<UserStatusHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const filters = useCallback(
    () => ({
      search: debouncedSearch || undefined,
      fromStatus: fromStatus === 'all' ? undefined : fromStatus,
      toStatus: toStatus === 'all' ? undefined : toStatus,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, fromStatus, toStatus],
  );

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listUserStatusHistory(filters());
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
      const response = await listUserStatusHistory({ ...filters(), cursor: nextCursor });
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
        <h1 className="text-2xl font-bold text-foreground">User status history</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← All users
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by user name, email or phone…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-72 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <select
          value={fromStatus}
          onChange={(event) => setFromStatus(event.target.value as typeof fromStatus)}
          className={selectClass}
          aria-label="Previous status"
        >
          <option value="all">Any previous status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={toStatus}
          onChange={(event) => setToStatus(event.target.value as typeof toStatus)}
          className={selectClass}
          aria-label="New status"
        >
          <option value="all">Any new status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <UserStatusHistoryTable entries={entries} showUser />
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
