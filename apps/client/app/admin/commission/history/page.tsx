'use client';

import { LedgerList } from '@/components/commission/ledger-list';

export default function CommissionLedgerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">System commission ledger</h1>
        <p className="text-sm text-muted-foreground">System commission earned from orders and payments made by sellers. Voided rows were reversed or cancelled and no longer count.</p>
      </div>
      <LedgerList role="admin" />
    </div>
  );
}
