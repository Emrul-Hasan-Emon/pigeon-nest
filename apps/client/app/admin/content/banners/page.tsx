'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ScheduleBadge } from '@/components/admin/content/schedule-badge';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { deleteBanner, listBanners, updateBanner } from '@/lib/api/banners';
import { ApiError, ConflictApiError, NotFoundApiError } from '@/lib/api/http';
import { BANNER_POSITIONS, type Banner, type BannerListParams } from '@/types/banner';
import { LoadingBlock } from '@/components/ui/skeleton';
import { DELETE_ENABLED } from '@/lib/features';

const PAGE_SIZE = 20;
const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function AdminBannersPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [position, setPosition] = useState('');
  const [active, setActive] = useState('');
  const [schedule, setSchedule] = useState('');
  const [sort, setSort] = useState<'newest' | 'displayOrder'>('newest');

  const [banners, setBanners] = useState<Banner[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Banner | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const buildParams = useCallback(
    (cursor?: number): BannerListParams => ({
      search: debouncedSearch || undefined,
      position: (position || undefined) as BannerListParams['position'],
      isActive: active === '' ? undefined : active === 'true',
      schedule: (schedule || undefined) as BannerListParams['schedule'],
      sort,
      cursor,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, position, active, schedule, sort],
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listBanners(buildParams());
      setBanners(r.results);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load banners.', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildParams, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirst();
  }, [fetchFirst]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const r = await listBanners(buildParams(nextCursor));
      setBanners((c) => [...c, ...r.results]);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load more banners.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleActive(banner: Banner) {
    try {
      const updated = await updateBanner(banner.id, { isActive: !banner.isActive });
      setBanners((c) => c.map((b) => (b.id === updated.id ? updated : b)));
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        setBanners((c) => c.filter((b) => b.id !== banner.id));
        return showToast('That banner no longer exists.', 'error');
      }
      showToast(error instanceof ApiError ? error.message : 'Failed to update.', 'error');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteBanner(pendingDelete.id);
      setBanners((c) => c.filter((b) => b.id !== pendingDelete.id));
      showToast('Banner deleted.', 'success');
      setPendingDelete(null);
    } catch (error) {
      if (error instanceof ConflictApiError) return setConflict(error.message);
      if (error instanceof NotFoundApiError) {
        setBanners((c) => c.filter((b) => b.id !== pendingDelete.id));
        setPendingDelete(null);
        return showToast('That banner no longer exists.', 'error');
      }
      showToast(error instanceof ApiError ? error.message : 'Failed to delete.', 'error');
    }
  }

  async function deactivateInstead() {
    if (!pendingDelete) return;
    await toggleActive(pendingDelete);
    setPendingDelete(null);
    setConflict(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Banners</h1>
        <Link href="/admin/content/banners/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Add banner
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} className={`w-64 ${selectClass}`} />
        <select value={position} onChange={(e) => setPosition(e.target.value)} className={selectClass}>
          <option value="">All positions</option>
          {BANNER_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={active} onChange={(e) => setActive(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
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
        <LoadingBlock />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {['Image', 'Title', 'Position', 'Schedule', 'Sort', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {banners.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No banners found.</td></tr>
              )}
              {banners.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.imageUrl} alt="" className="h-10 w-20 rounded-md border border-border object-cover" />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{b.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{BANNER_POSITIONS.find((p) => p.value === b.position)?.label}</td>
                  <td className="px-4 py-3"><ScheduleBadge startsAt={b.startsAt} endsAt={b.endsAt} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{b.sortOrder}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleActive(b)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/content/banners/${b.id}`} className="mr-3 text-primary hover:underline">Edit</Link>
                    {DELETE_ENABLED && <button type="button" onClick={() => setPendingDelete(b)} className="text-destructive hover:underline">Delete</button>}
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

      {pendingDelete && !conflict && (
        <ConfirmDialog title="Delete banner" description={`Delete "${pendingDelete.title}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={confirmDelete} onClose={() => setPendingDelete(null)} />
      )}
      {pendingDelete && conflict && (
        <ConfirmDialog
          title="Can't delete banner"
          description={conflict}
          confirmLabel="Close"
          confirmVariant="primary"
          secondaryLabel="Deactivate instead"
          onSecondary={deactivateInstead}
          onConfirm={() => { setPendingDelete(null); setConflict(null); }}
          onClose={() => { setPendingDelete(null); setConflict(null); }}
        />
      )}
    </div>
  );
}
