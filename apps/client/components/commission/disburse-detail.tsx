'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AttachmentList, money, useApiError } from '@/components/orders/ui';
import { formatDateTime } from '@/lib/datetime';
import { commissionApi } from '@/lib/api/commission';
import type { CommissionRole, DisburseDetail } from '@/types/commission';
import { LoadingBlock } from '@/components/ui/skeleton';

export function DisburseDetailView({ role, id }: { role: CommissionRole; id: number }) {
  const api = useMemo(() => commissionApi(role), [role]);
  const errorMessage = useApiError(role);
  const [d, setD] = useState<DisburseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.disbursement(id).then(setD).catch((e) => setError(errorMessage(e, 'Failed to load this payment.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, id]);
  if (error) return <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  if (!d) return <LoadingBlock />;
  const rows: [string, string][] = [
    ['Amount received', money(d.amount)],
    ['Total commission at that time', money(d.totalAmount)],
    ['Still due after this payment', money(d.dueAmount)],
    ['Paid in total after this payment', money(d.paidAmount)],
    ['Date', formatDateTime(d.createdAt)],
    ...(role === 'admin' ? ([['Recorded by', d.recordedByName ?? '—'], ['Seller', d.sellerName ?? '—']] as [string, string][]) : []),
  ];
  return (
    <div className="max-w-2xl">
      <Link href={role === 'admin' ? '/admin/commission/disbursements' : '/seller/commission'} className="text-sm text-primary hover:underline">← {role === 'admin' ? 'Commission payments' : 'Commission'}</Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold text-foreground">Commission payment #{d.id}</h1>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <dl className="space-y-2 text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium text-foreground">{v}</dd></div>)}
        </dl>
        <div className="mt-4 border-t border-border pt-3 text-sm">
          <p className="text-muted-foreground">Notes</p>
          <p className="text-foreground">{d.notes || 'No notes.'}</p>
        </div>
        <div className="mt-4 border-t border-border pt-3 text-sm">
          <p className="text-muted-foreground">Attachments</p>
          {d.attachments.length === 0 ? <p className="text-foreground">No files attached.</p> : <AttachmentList items={d.attachments} />}
        </div>
      </div>
    </div>
  );
}
