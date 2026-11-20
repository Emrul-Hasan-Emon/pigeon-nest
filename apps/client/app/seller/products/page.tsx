'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import {
  PRODUCT_ACTIVE_STYLES,
  ProductActiveBadge,
  ProductStatusBadge,
} from '@/components/products/status-badges';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { deleteMyProduct, listMyProducts, updateMyProduct } from '@/lib/api/seller-products';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { Product, ProductActiveStatus, ProductStatus } from '@/types/product';

const PAGE_SIZE = 20;

const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function SellerProductsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<'all' | ProductStatus>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | ProductActiveStatus>('all');

  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const filters = useCallback(
    () => ({
      search: debouncedSearch || undefined,
      status: status === 'all' ? undefined : status,
      activeStatus: activeStatus === 'all' ? undefined : activeStatus,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, status, activeStatus],
  );

  const handleError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiError && error.status === 401) {
        clearSellerToken();
        router.replace('/seller/login');
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setBlocked(error.message);
        return;
      }
      showToast(error instanceof ApiError ? error.message : fallback, 'error');
    },
    [router, showToast],
  );

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listMyProducts(filters());
      setProducts(response.results);
      setNextCursor(response.nextCursor);
      setBlocked(null);
    } catch (error) {
      handleError(error, 'Failed to load your products.');
    } finally {
      setLoading(false);
    }
  }, [filters, handleError]);

  useEffect(() => {
    if (!getSellerToken()) {
      router.replace('/seller/login');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage, router]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listMyProducts({ ...filters(), cursor: nextCursor });
      setProducts((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch (error) {
      handleError(error, 'Failed to load more products.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleChangeActive(product: Product, next: ProductActiveStatus) {
    if (next === product.activeStatus) return;
    try {
      const updated = await updateMyProduct(product.id, { activeStatus: next });
      setProducts((current) =>
        current.map((row) => (row.id === product.id ? { ...row, ...updated } : row)),
      );
    } catch (error) {
      // The row may have been rejected / suspended since the list loaded.
      fetchFirstPage();
      handleError(error, 'Failed to update the product.');
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      await deleteMyProduct(target.id);
      setProducts((current) => current.filter((row) => row.id !== target.id));
      showToast('Product deleted.', 'success');
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        setProducts((current) => current.filter((row) => row.id !== target.id));
      } else {
        fetchFirstPage();
      }
      handleError(error, 'Failed to delete the product.');
    } finally {
      setPendingDelete(null);
    }
  }

  const isLocked = (product: Product) =>
    product.status === 'rejected' || product.activeStatus === 'suspended';

  return (
    <div className="min-h-screen bg-background pl-56">
      <SellerSidebar active="products" />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">My products</h1>
          {!blocked && (
            <Link
              href="/seller/products/new"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Add product
            </Link>
          )}
        </div>

        {blocked && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            <p className="font-semibold">Products are not available right now</p>
            <p className="mt-0.5">{blocked}</p>
            <Link href="/seller/profile" className="mt-2 inline-block font-medium underline">
              Go to my profile
            </Link>
          </div>
        )}

        {!blocked && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search product name…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-64 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className={selectClass}
                aria-label="Status filter"
              >
                <option value="all">All statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={activeStatus}
                onChange={(event) => setActiveStatus(event.target.value as typeof activeStatus)}
                className={selectClass}
                aria-label="Activity filter"
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
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Image</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Activity</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                          No products found.
                        </td>
                      </tr>
                    )}
                    {products.map((product) => {
                      const locked = isLocked(product);
                      return (
                        <tr key={product.id} className="align-top">
                          <td className="px-4 py-3">
                            {product.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.thumbnailUrl}
                                alt=""
                                className="h-10 w-10 rounded-md border border-border object-cover"
                              />
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {product.name}
                            {product.status === 'rejected' && product.rejectionReason && (
                              <p className="mt-0.5 text-xs font-normal text-red-700">
                                Rejected: {product.rejectionReason}
                              </p>
                            )}
                            {product.activeStatus === 'suspended' && product.suspensionReason && (
                              <p className="mt-0.5 text-xs font-normal text-red-700">
                                Suspended: {product.suspensionReason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{product.category?.name ?? '—'}</td>
                          <td className="px-4 py-3">
                            <ProductStatusBadge status={product.status} />
                          </td>
                          <td className="px-4 py-3">
                            {locked ? (
                              <ProductActiveBadge status={product.activeStatus} />
                            ) : (
                              <select
                                aria-label={`Activity of ${product.name}`}
                                value={product.activeStatus}
                                onChange={(event) =>
                                  handleChangeActive(product, event.target.value as ProductActiveStatus)
                                }
                                className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium capitalize ${PRODUCT_ACTIVE_STYLES[product.activeStatus]}`}
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-3">
                              <Link
                                href={`/seller/products/${product.id}`}
                                className="font-medium text-primary hover:opacity-70"
                              >
                                {locked ? 'View' : 'Edit'}
                              </Link>
                              {!locked && (
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete(product)}
                                  className="font-medium text-destructive hover:opacity-70"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
          </>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title="Delete product"
            description={`Delete "${pendingDelete.name}"? This cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={handleConfirmDelete}
            onClose={() => setPendingDelete(null)}
          />
        )}
      </main>
    </div>
  );
}
