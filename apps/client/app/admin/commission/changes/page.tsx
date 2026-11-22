'use client';

import { ChangeLog } from '@/components/commission/change-log';

export default function CommissionChangesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Balance changes</h1>
        <p className="text-sm text-muted-foreground">Every move of a seller&apos;s commission balance: what total, due and paid were, and what they became.</p>
      </div>
      <ChangeLog role="admin" />
    </div>
  );
}
