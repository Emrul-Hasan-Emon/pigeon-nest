'use client';

import { PaymentClaimsList } from '@/components/payments/claims-list';
import { SellerFrame } from '@/components/seller/seller-frame';

export default function SellerPaymentClaimsPage() {
  return (
    <SellerFrame width="max-w-4xl">
      <h1 className="mb-1 text-foreground">Mark as paid requests</h1>
      <p className="mb-5 text-base text-muted-foreground">When a buyer paid in advance for a cash on delivery order that you accepted, they can send one request with proof. Check it, then accept it (the order is marked as paid) or reject it. A buyer cannot send another request for the same order.</p>
      <PaymentClaimsList role="seller" />
    </SellerFrame>
  );
}
