'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductTable } from '@/components/admin/catalog/products/product-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { deleteProduct, listProducts, updateProduct } from '@/lib/api/products';
import { ApiError, ConflictApiError, NotFoundApiError } from '@/lib/api/http';
import type { Product } from '@/types/product';

const PAGE_SIZE = 20;

type PublishFilter = 'all' | 'published' | 'unpublished';
type ActiveFilter = 'all' | 'active' | 'inactive';

export default function AdminProductsPage() {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [sellerSearch, setSellerSearch] = useState('');
  const debouncedSellerSearch = useDebouncedValue(sellerSearch);
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const buildFilters = useCallback(
    () => ({
      search: debouncedSearch || undefined,
      sellerSearch: debouncedSellerSearch.trim() || undefined,
      isPublished: publishFilter === 'all' ? undefined : publishFilter === 'published',
      isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
    }),
    [debouncedSearch, debouncedSellerSearch, publishFilter, activeFilter],
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

  async function handleToggleActive(product: Product) {
    try {
      const updated = await updateProduct(product.id, { isActive: !product.isActive });
      replaceRow({ ...product, ...updated });
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        removeRow(product.id);
        showToast('That product no longer exists.', 'error');
        return;
      }
      showToast(
        error instanceof ApiError ? error.message : 'Failed to update status.',
        'error',
      );
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
        <Link
          href="/admin/catalog/products/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Add product
        </Link>
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
          value={publishFilter}
          onChange={(event) => setPublishFilter(event.target.value as PublishFilter)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="all">All publish states</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <ProductTable
          products={products}
          onToggleActive={handleToggleActive}
          onDelete={(product) => setPendingDelete(product)}
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
