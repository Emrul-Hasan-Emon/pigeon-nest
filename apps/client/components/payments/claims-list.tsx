'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoadingBlock } from '@/components/ui/skeleton';
import { listPaymentClaims } from '@/lib/api/payment-claims';
import { formatDateTime } from '@/lib/datetime';
import { ApiError } from '@/lib/api/http';
import { ClaimBadge, ClaimDecision, ClaimFacts } from './claim-actions';
import type { ClaimPage, PaymentClaimStatus } from '@/types/payment';

const TABS: { value: PaymentClaimStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'To check' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Not accepted' },
  { value: 'all', label: 'All' },
];

/** The "I have paid" messages buyers sent, for the seller (their own) or the admin (all). */
export function PaymentClaimsList({ role }: { role: 'admin' | 'seller' }) {
  const [status, setStatus] = useState<PaymentClaimStatus | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ClaimPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listPaymentClaims(role, { status: status === 'all' ? undefined : status, page, pageSize: 10 })
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the requests.'))
      .finally(() => setLoading(false));
  }, [role, status, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const pill = (on: boolean) => `rounded-full border px-4 py-2 font-medium ${on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:bg-muted'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
        {TABS.map((t) => <button key={t.value} type="button" aria-pressed={status === t.value} className={pill(status === t.value)} onClick={() => { setStatus(t.value); setPage(1); }}>{t.label}</button>)}
      </div>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-destructive">{error}</p>}
      {loading && !data ? (
        <LoadingBlock />
      ) : data && data.results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">{status === 'pending' ? 'Nothing to check. Every request has been answered.' : 'No requests here.'}</p>
      ) : (
        <ul className="space-y-3">
          {data?.results.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/${role}/orders/${c.order.id}`} className="font-semibold text-primary hover:underline">{c.order.orderNumber}</Link>
                <ClaimBadge status={c.status} />
                <span className="text-sm text-muted-foreground">{c.buyerName} · {formatDateTime(c.createdAt)}</span>
                <span className="ml-auto text-sm text-muted-foreground">Order total ৳{c.order.payable.toLocaleString()} · paid ৳{c.order.paid.toLocaleString()}</span>
              </div>
              <ClaimFacts claim={c} />
              {c.status === 'pending' ? (
                <div className="mt-3"><ClaimDecision role={role} claim={c} balance={Math.max(0, c.order.payable - c.order.paid)} onDone={load} /></div>
              ) : (
                (c.decisionNote || c.decidedByName) && <p className="mt-2 text-sm text-muted-foreground">{c.decidedByName ? `${c.decidedByName}: ` : ''}{c.decisionNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Previous</button>
          <span className="text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
