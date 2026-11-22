'use client';

import Link from 'next/link';
import { ReturnList } from '@/components/returns/return-list';
import { primaryButton } from '@/components/orders/ui';

export default function AdminReturnsPage() {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Returns</h1>
          <p className="text-sm text-muted-foreground">Every return request. You can move any return to any status, and open one for a customer.</p>
        </div>
        <Link href="/admin/returns/new" className={primaryButton}>Open a return</Link>
      </div>
      <ReturnList role="admin" />
    </div>
  );
}
