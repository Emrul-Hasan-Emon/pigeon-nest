'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AttributeTable } from '@/components/admin/catalog/attributes/attribute-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { deleteAttribute, listAttributes, updateAttribute } from '@/lib/api/attributes';
import { ApiError, ConflictApiError, NotFoundApiError } from '@/lib/api/http';
import type { Attribute } from '@/types/attribute';

const PAGE_SIZE = 20;

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function AdminAttributesPage() {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attribute | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAttributes({
        search: debouncedSearch || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        limit: PAGE_SIZE,
      });
      setAttributes(response.results);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load attributes.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeFilter, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirstPage();
  }, [fetchFirstPage]);

  async function handleLoadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const response = await listAttributes({
        search: debouncedSearch || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setAttributes((current) => [...current, ...response.results]);
      setNextCursor(response.nextCursor);
    } catch {
      showToast('Failed to load more attributes.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function removeRow(id: number) {
    setAttributes((current) => current.filter((attribute) => attribute.id !== id));
  }

  function replaceRow(attribute: Attribute) {
    setAttributes((current) =>
      current.map((row) => (row.id === attribute.id ? attribute : row)),
    );
  }

  async function handleToggleActive(attribute: Attribute) {
    try {
      const updated = await updateAttribute(attribute.id, {
        isActive: !attribute.isActive,
      });
      replaceRow({ ...updated, values: attribute.values });
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        removeRow(attribute.id);
        showToast('That attribute no longer exists.', 'error');
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
      await deleteAttribute(pendingDelete.id);
      removeRow(pendingDelete.id);
      showToast('Attribute deleted.', 'success');
      setPendingDelete(null);
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        removeRow(pendingDelete.id);
        showToast('That attribute no longer exists.', 'error');
        setPendingDelete(null);
        return;
      }
      if (error instanceof ConflictApiError) {
        setConflictMessage(error.message);
        return;
      }
      showToast(
        error instanceof ApiError ? error.message : 'Failed to delete attribute.',
        'error',
      );
    }
  }

  async function handleDeactivateInstead() {
    if (!pendingDelete) return;
    await handleToggleActive(pendingDelete);
    showToast('Attribute deactivated instead.', 'success');
    setPendingDelete(null);
    setConflictMessage(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Attributes</h1>
        <Link
          href="/admin/catalog/attributes/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Add attribute
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
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <AttributeTable
          attributes={attributes}
          onToggleActive={handleToggleActive}
          onDelete={(attribute) => setPendingDelete(attribute)}
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
          title="Delete attribute"
          description={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {pendingDelete && conflictMessage && (
        <ConfirmDialog
          title="Can't delete attribute"
          description={conflictMessage}
          confirmLabel="Close"
          confirmVariant="primary"
          secondaryLabel="Deactivate instead"
          onSecondary={handleDeactivateInstead}
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
