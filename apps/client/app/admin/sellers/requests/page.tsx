'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { approveSellerRequest, listSellerRequests, rejectSellerRequest } from '@/lib/api/sellers';
import { ApiError } from '@/lib/api/http';
import type { Seller } from '@/types/seller';

const PAGE_SIZE = 20;

function Doc({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-xs text-muted-foreground">No {label}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-16 w-24 rounded-md border border-border object-cover" />
    </a>
  );
}

export default function SellerRequestsPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [requests, setRequests] = useState<Seller[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [rejecting, setRejecting] = useState<Seller | null>(null);
  const [reason, setReason] = useState('');

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listSellerRequests({
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
      });
      setRequests(response.results);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load requests.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listSellerRequests({
        search: debouncedSearch || undefined,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setRequests((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load more requests.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function dropRow(id: number) {
    setRequests((current) => current.filter((row) => row.id !== id));
  }

  async function handleApprove(seller: Seller) {
    setBusyId(seller.id);
    try {
      await approveSellerRequest(seller.id);
      dropRow(seller.id);
      showToast(`${seller.name} approved.`, 'success');
    } catch (error) {
      // 404/409: already handled or gone — refresh the list.
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        dropRow(seller.id);
      }
      showToast(error instanceof ApiError ? error.message : 'Failed to approve.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    const seller = rejecting;
    setBusyId(seller.id);
    try {
      await rejectSellerRequest(seller.id, reason.trim() || undefined);
      dropRow(seller.id);
      showToast(`${seller.name} rejected.`, 'success');
      setRejecting(null);
      setReason('');
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        dropRow(seller.id);
        setRejecting(null);
        setReason('');
      }
      showToast(error instanceof ApiError ? error.message : 'Failed to reject.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pending seller requests</h1>
        <Link href="/admin/sellers" className="text-sm text-muted-foreground hover:text-foreground">
          ← All sellers
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search by name, email or phone…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-4 w-72 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
      />

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-border bg-card py-10 text-center text-muted-foreground">
          No pending requests.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((seller) => (
            <div
              key={seller.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="min-w-48 flex-1">
                <p className="font-semibold text-foreground">{seller.name}</p>
                <p className="text-sm text-muted-foreground">{seller.phone}</p>
                <p className="text-sm text-muted-foreground">{seller.email ?? 'No email'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registered {new Date(seller.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Doc url={seller.avatarUrl} label="photo" />
                <Doc url={seller.nidFrontImageUrl} label="NID front" />
                <Doc url={seller.nidBackImageUrl} label="NID back" />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === seller.id}
                  onClick={() => handleApprove(seller)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === seller.id}
                  onClick={() => {
                    setRejecting(seller);
                    setReason('');
                  }}
                  className="rounded-md border border-destructive px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
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

      {rejecting && (
        <Modal title={`Reject ${rejecting.name}?`} onClose={() => setRejecting(null)} widthClassName="max-w-md">
          <label className="block text-sm text-foreground">
            Reason (optional, shown to the seller)
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(null)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId === rejecting.id}
              onClick={handleReject}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
