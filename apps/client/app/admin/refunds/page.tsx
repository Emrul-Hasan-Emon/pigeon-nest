'use client';

import { RefundsList } from '@/components/refunds/refunds-list';

export default function AdminRefundsPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Refunds</h1>
      <p className="mb-5 text-sm text-muted-foreground">Cancelled orders that had money paid. The seller sends the money back and records it. You can set any status, and add another record when a buyer says an earlier one never arrived.</p>
      <RefundsList role="admin" />
    </div>
  );
}
