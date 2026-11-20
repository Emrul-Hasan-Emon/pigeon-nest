'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import {
  deleteHomepageSection,
  listHomepageSections,
  listHomepageSlots,
  listSectionTypes,
  updateHomepageSection,
  updateHomepageSlot,
} from '@/lib/api/homepage';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { ScheduleBadge } from '../schedule-badge';
import { ReorderModal } from './reorder-modal';
import type { HomepageListParams, HomepageSection, SectionTypeDefinition } from '@/types/homepage';

const PAGE_SIZE = 20;
const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function SectionList({ mode }: { mode: 'section' | 'slot' }) {
  const isSlot = mode === 'slot';
  const base = isSlot ? '/admin/content/homepage-slots' : '/admin/content/homepage';
  const { showToast } = useToast();

  const [types, setTypes] = useState<SectionTypeDefinition[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [sectionType, setSectionType] = useState('');
  const [active, setActive] = useState('');
  const [device, setDevice] = useState('');
  const [schedule, setSchedule] = useState('');
  // Newest first is the default for sections, slot order for slots. Display
  // order is a filter the admin turns on.
  const [sort, setSort] = useState<'newest' | 'displayOrder'>(isSlot ? 'displayOrder' : 'newest');

  const [rows, setRows] = useState<HomepageSection[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HomepageSection | null>(null);
  const [reordering, setReordering] = useState(false);

  const fetchPage = isSlot ? listHomepageSlots : listHomepageSections;
  const update = isSlot ? updateHomepageSlot : updateHomepageSection;

  useEffect(() => {
    listSectionTypes().then(setTypes).catch(() => undefined);
  }, []);

  const buildParams = useCallback(
    (cursor?: number): HomepageListParams => ({
      search: debouncedSearch || undefined,
      sectionType: sectionType || undefined,
      isActive: active === '' ? undefined : active === 'true',
      deviceVisibility: (device || undefined) as HomepageListParams['deviceVisibility'],
      schedule: (schedule || undefined) as HomepageListParams['schedule'],
      sort,
      cursor,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, sectionType, active, device, schedule, sort],
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchPage(buildParams());
      setRows(r.results);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load.', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildParams, fetchPage, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirst();
  }, [fetchFirst]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const r = await fetchPage(buildParams(nextCursor));
      setRows((c) => [...c, ...r.results]);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load more.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleActive(row: HomepageSection) {
    try {
      const updated = await update(row.id, { isActive: !row.isActive });
      setRows((c) => c.map((r) => (r.id === row.id ? { ...r, isActive: updated.isActive } : r)));
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        setRows((c) => c.filter((r) => r.id !== row.id));
        return showToast('That section no longer exists.', 'error');
      }
      showToast(error instanceof ApiError ? error.message : 'Failed to update.', 'error');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteHomepageSection(pendingDelete.id);
      setRows((c) => c.filter((r) => r.id !== pendingDelete.id));
      showToast('Section deleted.', 'success');
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        setRows((c) => c.filter((r) => r.id !== pendingDelete.id));
      } else {
        showToast(error instanceof ApiError ? error.message : 'Failed to delete.', 'error');
      }
    }
    setPendingDelete(null);
  }

  const typeLabel = (t: string) => types.find((d) => d.type === t)?.label ?? t;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isSlot ? 'Homepage slots' : 'Homepage sections'}</h1>
          {isSlot && <p className="text-sm text-muted-foreground">Four fixed positions. Edit what each one shows; slots cannot be added, removed or moved.</p>}
        </div>
        {!isSlot && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setReordering(true)} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Reorder
            </button>
            <Link href={`${base}/new`} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Add section
            </Link>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} className={`w-64 ${selectClass}`} />
        <select value={sectionType} onChange={(e) => setSectionType(e.target.value)} className={selectClass}>
          <option value="">All types</option>
          {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <select value={active} onChange={(e) => setActive(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select value={device} onChange={(e) => setDevice(e.target.value)} className={selectClass}>
          <option value="">All devices</option>
          <option value="both">Mobile and web</option>
          <option value="mobile">Mobile only</option>
          <option value="web">Web only</option>
        </select>
        <select value={schedule} onChange={(e) => setSchedule(e.target.value)} className={selectClass}>
          <option value="">Any schedule</option>
          <option value="live">Live now</option>
          <option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'displayOrder')} className={selectClass}>
          <option value="newest">Newest first</option>
          <option value="displayOrder">Display order</option>
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {[isSlot ? 'Slot' : 'Order', 'Title', 'Type', 'Layout', 'Device', 'Schedule', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Nothing found.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-muted-foreground">{isSlot ? r.slotNo : r.sortOrder}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{typeLabel(r.sectionType)}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{r.layout}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{r.deviceVisibility}</td>
                  <td className="px-4 py-3"><ScheduleBadge startsAt={r.startsAt} endsAt={r.endsAt} /></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleActive(r)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`${base}/${r.id}`} className="mr-3 text-primary hover:underline">Edit</Link>
                    {!isSlot && (
                      <button type="button" onClick={() => setPendingDelete(r)} className="text-destructive hover:underline">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog title="Delete section" description={`Delete "${pendingDelete.title}"? It disappears from the homepage.`} confirmLabel="Delete" onConfirm={confirmDelete} onClose={() => setPendingDelete(null)} />
      )}
      {reordering && <ReorderModal onClose={() => setReordering(false)} onSaved={fetchFirst} />}
    </div>
  );
}
