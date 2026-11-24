'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { QuoteChecker } from '@/components/admin/settings/shipping/quote-checker';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { deleteZone, listCountries, listZones, updateZone } from '@/lib/api/shipping';
import { ApiError, ConflictApiError, NotFoundApiError } from '@/lib/api/http';
import { DELIVERY_TYPES, type Country, type ShippingZone, type ZoneListParams } from '@/types/shipping';
import { LoadingBlock } from '@/components/ui/skeleton';
import { DELETE_ENABLED } from '@/lib/features';

const PAGE_SIZE = 20;
const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function ShippingZonesPage() {
  const { showToast } = useToast();
  const [countries, setCountries] = useState<Country[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [type, setType] = useState('');
  const [active, setActive] = useState('');
  const [country, setCountry] = useState('');

  const [rows, setRows] = useState<ShippingZone[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ShippingZone | null>(null);

  useEffect(() => {
    listCountries().then(setCountries).catch(() => undefined);
  }, []);
  const nameOf = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

  const params = useCallback(
    (cursor?: number): ZoneListParams => ({
      search: debouncedSearch || undefined,
      deliveryType: (type || undefined) as ZoneListParams['deliveryType'],
      isActive: active === '' ? undefined : active === 'true',
      country: country || undefined,
      cursor,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, type, active, country],
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listZones(params());
      setRows(r.results);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load shipping zones.', 'error');
    } finally {
      setLoading(false);
    }
  }, [params, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFirst();
  }, [fetchFirst]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const r = await listZones(params(nextCursor));
      setRows((c) => [...c, ...r.results]);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load more.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleActive(row: ShippingZone) {
    try {
      const updated = await updateZone(row.id, { isActive: !row.isActive });
      setRows((c) => c.map((r) => (r.id === row.id ? updated : r)));
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        setRows((c) => c.filter((r) => r.id !== row.id));
        return showToast('That zone no longer exists.', 'error');
      }
      // activating can clash with another active zone: the message names it
      showToast(error instanceof ConflictApiError || error instanceof ApiError ? error.message : 'Failed to update.', 'error');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteZone(pendingDelete.id);
      setRows((c) => c.filter((r) => r.id !== pendingDelete.id));
      showToast('Zone deleted.', 'success');
    } catch (error) {
      if (error instanceof NotFoundApiError) setRows((c) => c.filter((r) => r.id !== pendingDelete.id));
      else showToast(error instanceof ApiError ? error.message : 'Failed to delete.', 'error');
    }
    setPendingDelete(null);
  }

  const typeLabel = (t: string) => DELIVERY_TYPES.find((d) => d.value === t)?.label ?? t;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shipping zones</h1>
          <p className="text-sm text-muted-foreground">Destinations no active zone covers use the default charge in General settings.</p>
        </div>
        <Link href="/admin/settings/shipping-zones/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Add zone
        </Link>
      </div>

      <QuoteChecker />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className={`w-56 ${selectClass}`} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option value="">All delivery types</option>
          {DELIVERY_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
          <option value="">Any country</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <select value={active} onChange={(e) => setActive(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {['Zone', 'Delivery', 'Countries', 'Charge', 'Days', 'Live birds', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No shipping zones found.</td></tr>
              )}
              {rows.map((z) => (
                <tr key={z.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{z.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{typeLabel(z.deliveryType)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {z.countryCodes.slice(0, 3).map(nameOf).join(', ')}
                    {z.countryCodes.length > 3 && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">+{z.countryCodes.length - 3}</span>}
                  </td>
                  <td className="px-4 py-3 text-foreground">{z.charge}</td>
                  <td className="px-4 py-3 text-muted-foreground">{z.estimatedDays}</td>
                  <td className="px-4 py-3 text-muted-foreground">{z.supportsLiveAnimal ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleActive(z)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${z.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {z.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/settings/shipping-zones/${z.id}`} className="mr-3 text-primary hover:underline">Edit</Link>
                    {DELETE_ENABLED && <button type="button" onClick={() => setPendingDelete(z)} className="text-destructive hover:underline">Delete</button>}
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
        <ConfirmDialog title="Delete zone" description={`Delete "${pendingDelete.name}"? Its countries fall back to the default charge.`} confirmLabel="Delete" onConfirm={confirmDelete} onClose={() => setPendingDelete(null)} />
      )}
    </div>
  );
}
