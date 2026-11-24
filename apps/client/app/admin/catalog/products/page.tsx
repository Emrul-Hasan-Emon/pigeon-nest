'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QuickEdit } from '@/components/seller/quick-edit';
import { ProductTable } from '@/components/admin/catalog/products/product-table';
import { ReasonModal } from '@/components/admin/sellers/reason-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { adminProductPortal } from '@/lib/products/portal';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { copyProduct, deleteProduct, listProducts, updateProduct } from '@/lib/api/products';
import { ApiError, ConflictApiError, NotFoundApiError } from '@/lib/api/http';
import type { Product, ProductActiveStatus, ProductListSort, ProductStatus } from '@/types/product';
import { LoadingBlock } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | ProductStatus;
type ActiveFilter = 'all' | ProductActiveStatus;

// A change that needs a note before it is sent (reject / suspend).
type PendingReason =
  | { product: Product; kind: 'status'; value: 'rejected' }
  | { product: Product; kind: 'active'; value: 'suspended' };

export default function AdminProductsPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [quickEditId, setQuickEditId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [sellerSearch, setSellerSearch] = useState('');
  const debouncedSellerSearch = useDebouncedValue(sellerSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [sort, setSort] = useState<ProductListSort>('newest');

  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState<PendingReason | null>(null);
  const [savingReason, setSavingReason] = useState(false);

  const buildFilters = useCallback(
    () => ({
      search: debouncedSearch || undefined,
      sellerSearch: debouncedSellerSearch.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      activeStatus: activeFilter === 'all' ? undefined : activeFilter,
      sort: sort === 'newest' ? undefined : sort,
    }),
    [debouncedSearch, debouncedSellerSearch, statusFilter, activeFilter, sort],
  );

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listProducts({ ...buildFilters(), limit: PAGE_SIZE });
      setProducts(response.results);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load products.', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildFilters, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listProducts({
        ...buildFilters(),
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setProducts((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load more products.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function removeRow(id: number) {
    setProducts((current) => current.filter((product) => product.id !== id));
  }

  function replaceRow(product: Product) {
    setProducts((current) =>
      current.map((row) => (row.id === product.id ? product : row)),
    );
  }

  async function applyChange(
    product: Product,
    change: { status?: ProductStatus; activeStatus?: ProductActiveStatus },
    reason?: string,
  ) {
    try {
      const updated = await updateProduct(product.id, { ...change, ...(reason ? { reason } : {}) });
      replaceRow({ ...product, ...updated });
      showToast('Product updated.', 'success');
      return true;
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        removeRow(product.id);
        showToast('That product no longer exists.', 'error');
        return true;
      }
      showToast(
        error instanceof ApiError ? error.message : 'Failed to update the product.',
        'error',
      );
      return false;
    }
  }

  function handleChangeStatus(product: Product, status: ProductStatus) {
    if (status === product.status) return;
    if (status === 'rejected') {
      setPendingReason({ product, kind: 'status', value: 'rejected' });
      return;
    }
    void applyChange(product, { status });
  }

  function handleChangeActive(product: Product, activeStatus: ProductActiveStatus) {
    if (activeStatus === product.activeStatus) return;
    if (activeStatus === 'suspended') {
      setPendingReason({ product, kind: 'active', value: 'suspended' });
      return;
    }
    void applyChange(product, { activeStatus });
  }

  async function handleConfirmReason(reason: string) {
    if (!pendingReason) return;
    setSavingReason(true);
    const change =
      pendingReason.kind === 'status'
        ? { status: pendingReason.value }
        : { activeStatus: pendingReason.value };
    const done = await applyChange(pendingReason.product, change, reason);
    setSavingReason(false);
    if (done) setPendingReason(null);
  }

  // A copy is a new product, switched off, for the same seller. The admin lands on its edit page.
  async function handleCopy(product: Product) {
    try {
      const copy = await copyProduct(product.id);
      showToast('Copied. The copy is switched off until you turn it on.', 'success');
      router.push(`/admin/catalog/products/${copy.id}/edit`);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not copy the product.', 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteProduct(pendingDelete.id);
      removeRow(pendingDelete.id);
      showToast('Product deleted.', 'success');
      setPendingDelete(null);
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        removeRow(pendingDelete.id);
        showToast('That product no longer exists.', 'error');
        setPendingDelete(null);
        return;
      }
      if (error instanceof ConflictApiError) {
        setConflictMessage(error.message);
        return;
      }
      showToast(
        error instanceof ApiError ? error.message : 'Failed to delete product.',
        'error',
      );
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Products</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/catalog/products/status-history"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Status history
          </Link>
          <Link
            href="/admin/catalog/products/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Add product
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search product name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <input
          type="text"
          placeholder="Seller name, email or phone…"
          value={sellerSearch}
          onChange={(event) => setSellerSearch(event.target.value)}
          className="w-72 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
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
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as ProductListSort)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          aria-label="Sort"
        >
          <option value="newest">Newest first</option>
          <option value="mostSaved">Most saved first</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <ProductTable
          products={products}
          onChangeStatus={handleChangeStatus}
          onChangeActive={handleChangeActive}
          onDelete={(product) => setPendingDelete(product)}
          onCopy={handleCopy}
          onQuickEdit={(product) => setQuickEditId(product.id)}
        />
      )}

      {quickEditId !== null && (
        <QuickEdit
          productId={quickEditId}
          portal={adminProductPortal}
          onClose={() => setQuickEditId(null)}
          onSaved={(updated) => {
            setProducts((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
            setQuickEditId(null);
            showToast('Saved.', 'success');
          }}
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

      {pendingReason && (
        <ReasonModal
          title={
            pendingReason.kind === 'status'
              ? `Reject "${pendingReason.product.name}"?`
              : `Suspend "${pendingReason.product.name}"?`
          }
          label="Reason (required, shown to the seller and saved in the history)"
          confirmLabel={pendingReason.kind === 'status' ? 'Reject' : 'Suspend'}
          busy={savingReason}
          onConfirm={handleConfirmReason}
          onClose={() => setPendingReason(null)}
        />
      )}

      {pendingDelete && !conflictMessage && (
        <ConfirmDialog
          title="Delete product"
          description={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {pendingDelete && conflictMessage && (
        <ConfirmDialog
          title="Can't delete product"
          description={conflictMessage}
          confirmLabel="Close"
          confirmVariant="primary"
          onConfirm={() => {
            setPendingDelete(null);
            setConflictMessage(null);
          }}
          onClose={() => {
            setPendingDelete(null);
            setConflictMessage(null);
          }}
        />
      )}
    </div>
  );
}
