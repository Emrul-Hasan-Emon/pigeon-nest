'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { deleteGateway, listGatewayTypes, listGateways, updateGateway } from '@/lib/api/payment-gateways';
import { ApiError, ConflictApiError, NotFoundApiError } from '@/lib/api/http';
import type { GatewayListParams, GatewayTypeRule, PaymentGateway } from '@/types/payment-gateway';

const PAGE_SIZE = 20;
const selectClass =
  'rounded-md border border-input bg-card px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function PaymentGatewaysPage() {
  const { showToast } = useToast();
  const [types, setTypes] = useState<GatewayTypeRule[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [type, setType] = useState('');
  const [active, setActive] = useState('');

  const [rows, setRows] = useState<PaymentGateway[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaymentGateway | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    listGatewayTypes().then(setTypes).catch(() => undefined);
  }, []);

  const params = useCallback(
    (cursor?: number): GatewayListParams => ({
      search: debouncedSearch || undefined,
      type: (type || undefined) as GatewayListParams['type'],
      isActive: active === '' ? undefined : active === 'true',
      cursor,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, type, active],
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listGateways(params());
      setRows(r.results);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load payment gateways.', 'error');
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
      const r = await listGateways(params(nextCursor));
      setRows((c) => [...c, ...r.results]);
      setNextCursor(r.nextCursor);
    } catch {
      showToast('Failed to load more.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleActive(row: PaymentGateway) {
    try {
      const updated = await updateGateway(row.id, { isActive: !row.isActive });
      setRows((c) => c.map((r) => (r.id === row.id ? updated : r)));
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        setRows((c) => c.filter((r) => r.id !== row.id));
        return showToast('That gateway no longer exists.', 'error');
      }
      showToast(error instanceof ApiError ? error.message : 'Failed to update.', 'error');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteGateway(pendingDelete.id);
      setRows((c) => c.filter((r) => r.id !== pendingDelete.id));
      showToast('Gateway deleted.', 'success');
      setPendingDelete(null);
    } catch (error) {
      if (error instanceof ConflictApiError) return setConflict(error.message);
      if (error instanceof NotFoundApiError) {
        setRows((c) => c.filter((r) => r.id !== pendingDelete.id));
        setPendingDelete(null);
        return showToast('That gateway no longer exists.', 'error');
      }
      showToast(error instanceof ApiError ? error.message : 'Failed to delete.', 'error');
    }
  }

  async function deactivateInstead() {
    if (!pendingDelete) return;
    await toggleActive({ ...pendingDelete, isActive: true });
    setPendingDelete(null);
    setConflict(null);
  }

  const label = (t: string) => types.find((r) => r.type === t)?.label ?? t;
  const summary = (g: PaymentGateway) =>
    [g.accountName, g.accountNumber, g.bankName].filter(Boolean).join(' · ') || '—';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payment gateways</h1>
        <Link href="/admin/settings/payment-gateways/new" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Add gateway
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className={`w-64 ${selectClass}`} />
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option value="">All types</option>
          {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <select value={active} onChange={(e) => setActive(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                {['Icon', 'Name', 'Type', 'Account', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No payment gateways found.</td></tr>
              )}
              {rows.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3">
                    {g.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.iconUrl} alt="" className="h-9 w-9 rounded-md border border-border object-contain" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{g.name}<span className="block text-xs font-normal text-muted-foreground">{g.slug}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{label(g.type)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{summary(g)}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleActive(g)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${g.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {g.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/settings/payment-gateways/${g.id}`} className="mr-3 text-primary hover:underline">Edit</Link>
                    <button type="button" onClick={() => setPendingDelete(g)} className="text-destructive hover:underline">Delete</button>
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
        <ConfirmDialog title="Delete gateway" description={`Delete "${pendingDelete.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={confirmDelete} onClose={() => setPendingDelete(null)} />
      )}
      {pendingDelete && conflict && (
        <ConfirmDialog
          title="Can't delete gateway"
          description={conflict}
          confirmLabel="Close"
          confirmVariant="primary"
          secondaryLabel={pendingDelete.isActive ? 'Deactivate instead' : undefined}
          onSecondary={pendingDelete.isActive ? deactivateInstead : undefined}
          onConfirm={() => { setPendingDelete(null); setConflict(null); }}
          onClose={() => { setPendingDelete(null); setConflict(null); }}
        />
      )}
    </div>
  );
}
