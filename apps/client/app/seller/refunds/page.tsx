'use client';

import { RefundsList } from '@/components/refunds/refunds-list';
import { SellerFrame } from '@/components/seller/seller-frame';

export default function SellerRefundsPage() {
  return (
    <SellerFrame width="max-w-4xl">
      <h1 className="mb-1 text-foreground">Refunds</h1>
      <p className="mb-5 text-base text-muted-foreground">When an order that the buyer already paid for is cancelled, it appears here. Send the money back, then mark it as refunded with the exact amount, a note and proof. The buyer and the admin can see every step.</p>
      <RefundsList role="seller" />
    </SellerFrame>
  );
}
