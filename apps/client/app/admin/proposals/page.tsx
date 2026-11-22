'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminProposalList } from '@/components/admin/proposals/proposal-list';

function toId(v: string | null) {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : undefined;
}

function Content() {
  const q = useSearchParams();
  const userId = toId(q.get('userId'));
  const sellerId = toId(q.get('sellerId'));
  // Remount when the query changes so the removable chips start from the new values.
  return <AdminProposalList key={`${userId}-${sellerId}`} userId={userId} sellerId={sellerId} />;
}

export default function AdminProposalsPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Price proposals</h1>
        <p className="text-sm text-muted-foreground">Prices buyers offered for a SKU and how the seller answered. You can reject or cancel an open or accepted proposal.</p>
      </div>
      <Suspense fallback={<p className="py-10 text-center text-muted-foreground">Loading…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
