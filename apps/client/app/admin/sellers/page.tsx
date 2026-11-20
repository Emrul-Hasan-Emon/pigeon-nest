'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ReasonModal } from '@/components/admin/sellers/reason-modal';
import { SellerTable } from '@/components/admin/sellers/seller-table';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { listSellers, updateSeller } from '@/lib/api/sellers';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import type { Seller, SellerActiveStatus, SellerStatus } from '@/types/seller';

const PAGE_SIZE = 20;

type ActiveFilter = 'all' | SellerActiveStatus;
type StatusFilter = 'all' | SellerStatus;

export default function AdminSellersPage() {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suspending, setSuspending] = useState<Seller | null>(null);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listSellers({
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        activeStatus: activeFilter === 'all' ? undefined : activeFilter,
        limit: PAGE_SIZE,
      });
      setSellers(response.results);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load sellers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, activeFilter, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listSellers({
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        activeStatus: activeFilter === 'all' ? undefined : activeFilter,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setSellers((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load more sellers.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function replaceRow(seller: Seller) {
    setSellers((current) => current.map((row) => (row.id === seller.id ? seller : row)));
  }

  function removeRow(id: number) {
    setSellers((current) => current.filter((row) => row.id !== id));
  }

  // Suspending needs a note, so it goes through the reason prompt first.
  function handleChangeActive(seller: Seller, activeStatus: SellerActiveStatus) {
    if (activeStatus === 'suspended' && seller.activeStatus !== 'suspended') {
      setSuspending(seller);
      return;
    }
    applyActiveStatus(seller, activeStatus);
  }

  async function applyActiveStatus(
    seller: Seller,
    activeStatus: SellerActiveStatus,
    reason?: string,
  ) {
    try {
      const updated = await updateSeller(seller.id, { activeStatus, reason });
      replaceRow(updated);
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        removeRow(seller.id);
        showToast('That seller no longer exists.', 'error');
        return;
      }
      showToast(
        error instanceof ApiError ? error.message : 'Failed to update status.',
        'error',
      );
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Sellers</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/sellers/requests"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Pending requests
          </Link>
          <Link
            href="/admin/sellers/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Add seller
          </Link>
        </div>
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
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="all">Any activity</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <SellerTable sellers={sellers} onChangeActive={handleChangeActive} />
      )}

      {suspending && (
        <ReasonModal
          title={`Suspend ${suspending.name}?`}
          label="Reason (required, saved in the status history)"
          confirmLabel="Suspend"
          onConfirm={async (reason) => {
            const seller = suspending;
            setSuspending(null);
            await applyActiveStatus(seller, 'suspended', reason);
          }}
          onClose={() => setSuspending(null)}
        />
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
