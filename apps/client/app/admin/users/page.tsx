'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserTable } from '@/components/admin/users/user-table';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { listUsers } from '@/lib/api/users';
import type { User, UserStatus } from '@/types/user';
import { LoadingBlock } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');

  const [users, setUsers] = useState<User[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const params = useCallback(
    (cursor?: number) => ({
      search: debouncedSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      cursor,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, statusFilter],
  );

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listUsers(params());
      setUsers(response.results);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [params, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listUsers(params(nextCursor));
      setUsers((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load more users.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <Link
          href="/admin/users/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Add user
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-72 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | UserStatus)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <UserTable users={users} />
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
