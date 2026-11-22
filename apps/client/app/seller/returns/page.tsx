'use client';

import { SellerShell } from '@/components/orders/ui';
import { ReturnList } from '@/components/returns/return-list';

export default function SellerReturnsPage() {
  return (
    <SellerShell active="returns">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Returns</h1>
      <p className="mb-5 text-sm text-muted-foreground">Customers asking to send back an order or some of its items. Accept or reject, then follow it through to the refund.</p>
      <ReturnList role="seller" />
    </SellerShell>
  );
}
