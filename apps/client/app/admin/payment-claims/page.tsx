'use client';

import { PaymentClaimsList } from '@/components/payments/claims-list';

export default function AdminPaymentClaimsPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Mark as paid requests</h1>
      <p className="mb-5 text-sm text-muted-foreground">Every mark as paid request buyers sent for cash on delivery orders, for all sellers. The seller normally checks them; you can accept or reject any. A buyer can send only one request per order.</p>
      <PaymentClaimsList role="admin" />
    </div>
  );
}
