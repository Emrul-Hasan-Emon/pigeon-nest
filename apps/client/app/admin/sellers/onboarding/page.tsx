'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { listSellerOnboarding } from '@/lib/api/onboarding';
import type { OnboardingList } from '@/types/onboarding';

const PAGE_SIZE = 20;
const SHOW = [
  { value: 'all', label: 'All sellers' },
  { value: 'incomplete', label: 'Still setting up' },
  { value: 'complete', label: 'Fully set up' },
] as const;

export default function AdminSellerSetupPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const [show, setShow] = useState<'all' | 'incomplete' | 'complete'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OnboardingList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listSellerOnboarding({ search: q || undefined, show, page, pageSize: PAGE_SIZE })
      .then((r) => live && setData(r))
      .catch(() => live && showToast('Failed to load seller setup.', 'error'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [q, show, page, showToast]);

  const field = 'rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Seller setup</h1>
      <p className="mb-5 text-sm text-muted-foreground">How far each approved seller has got with setting up their shop: profile, ID, a first product with a picture, bird details, and a product on sale.</p>

      {data && (
        <dl className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">Sellers</dt><dd className="mt-1 text-2xl font-semibold">{data.summary.sellers}</dd></div>
          <div className="rounded-xl border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">Fully set up</dt><dd className="mt-1 text-2xl font-semibold">{data.summary.complete}</dd></div>
          <div className="rounded-xl border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">Average progress</dt><dd className="mt-1 text-2xl font-semibold">{data.summary.averagePercent}%</dd></div>
        </dl>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${field} w-64`} placeholder="Seller name or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {SHOW.map((s) => (
            <button key={s.value} type="button" aria-pressed={show === s.value} onClick={() => { setShow(s.value); setPage(1); }}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${show === s.value ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:bg-muted'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock />
      ) : (
        data && (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  {['Seller', 'Phone', 'Progress', 'Still to do'].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.results.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No sellers found.</td></tr>}
                {data.results.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.percent} aria-label={`${r.name} setup`} className="h-2.5 w-28 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${r.percent === 100 ? 'bg-emerald-600' : 'bg-primary'}`} style={{ width: `${r.percent}%` }} />
                        </div>
                        <span className="tabular-nums">{r.percent}%</span>
                        <span className="text-muted-foreground">({r.done}/{r.total})</span>
                      </div>
                    </td>
                    <td className="max-w-md px-4 py-3 text-muted-foreground">{r.missing.length === 0 ? 'Nothing: fully set up' : r.missing.join(' · ')}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/admin/sellers/${r.id}`} className="text-primary">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Previous</button>
          <span className="text-sm text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
