'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryTable } from '@/components/admin/catalog/categories/category-table';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { flattenCategoryTree } from '@/lib/category-tree';
import { getCategoryTree, listCategories, updateCategory } from '@/lib/api/categories';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import type { Category, CategoryTreeNode } from '@/types/category';

const PAGE_SIZE = 20;

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function AdminCategoriesPage() {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [parentFilter, setParentFilter] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const parentOptions = useMemo(() => flattenCategoryTree(tree), [tree]);

  const visibleCategories = useMemo(() => {
    if (parentFilter === '') return categories;
    if (parentFilter === 'root') return categories.filter((c) => c.parentId === null);
    return categories.filter((c) => c.parentId === Number(parentFilter));
  }, [categories, parentFilter]);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listCategories({
        search: debouncedSearch || undefined,
        isActive:
          activeFilter === 'all' ? undefined : activeFilter === 'active',
        limit: PAGE_SIZE,
      });
      setCategories(response.results);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load categories.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeFilter, showToast]);

  const fetchTree = useCallback(async () => {
    try {
      const nextTree = await getCategoryTree();
      setTree(nextTree);
    } catch {
      showToast('Failed to load category tree.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    // Data fetch on mount/filter change — setState happens inside the async
    // function after the request resolves, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTree();
  }, [fetchTree]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listCategories({
        search: debouncedSearch || undefined,
        isActive:
          activeFilter === 'all' ? undefined : activeFilter === 'active',
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setCategories((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load more categories.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function removeRow(id: number) {
    setCategories((current) => current.filter((category) => category.id !== id));
  }

  function replaceRow(category: Category) {
    setCategories((current) =>
      current.map((row) => (row.id === category.id ? category : row)),
    );
  }

  async function handleToggleActive(category: Category) {
    try {
      const updated = await updateCategory(category.id, {
        isActive: !category.isActive,
      });
      replaceRow(updated);
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        removeRow(category.id);
        showToast('That category no longer exists.', 'error');
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
        <h1 className="text-2xl font-bold text-foreground">Categories</h1>
        <Link
          href="/admin/catalog/categories/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Add category
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64 rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={parentFilter}
          onChange={(event) => setParentFilter(event.target.value)}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          <option value="">All parents</option>
          <option value="root">Root only</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {'—'.repeat(option.depth)} {option.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <CategoryTable
          categories={visibleCategories}
          tree={tree}
          onToggleActive={handleToggleActive}
        />
      )}
      {parentFilter !== '' && (
        <p className="mt-2 text-xs text-muted-foreground">
          Parent filter applies to the currently loaded rows only.
        </p>
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
