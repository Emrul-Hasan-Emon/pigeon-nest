'use client';

import { DisburseList } from '@/components/commission/disburse-list';

export default function CommissionPaymentsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">System commission payments</h1>
        <p className="text-sm text-muted-foreground">Money sellers handed over for system commission. Record one from a seller&apos;s system commission page.</p>
      </div>
      <DisburseList role="admin" />
    </div>
  );
}
