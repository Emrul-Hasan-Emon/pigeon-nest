'use client';

import { useEffect, useState } from 'react';
import { StatementView } from '@/components/payments/statement-view';
import { listSellers } from '@/lib/api/sellers';

export default function AdminStatementsPage() {
  const [sellers, setSellers] = useState<{ id: number; name: string }[]>([]);
  const [sellerId, setSellerId] = useState<number | undefined>(undefined);

  useEffect(() => {
    listSellers({ status: 'approved', limit: 100 })
      .then((r) => setSellers(r.results.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setSellers([]));
  }, []);

  return (
    <div>
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-foreground">Seller statements</h1>
        <p className="mb-4 text-sm text-muted-foreground">Pick a seller and a month to see or print their statement.</p>
        <label className="mb-4 block text-sm font-semibold">
          Seller
          <select className="mt-1 block rounded-md border border-input px-3 py-2" value={sellerId ?? ''} onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Choose a seller…</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      {sellerId ? <StatementView key={sellerId} role="admin" sellerId={sellerId} /> : <p className="text-muted-foreground print:hidden">Choose a seller to see their statement.</p>}
    </div>
  );
}
