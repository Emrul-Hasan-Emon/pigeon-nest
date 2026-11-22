'use client';

import { SellerShell } from '@/components/orders/ui';
import { SellerOffers } from '@/components/seller/proposals/seller-offers';

export default function SellerOffersPage() {
  return (
    <SellerShell active="offers">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Offers</h1>
      <p className="mb-5 text-sm text-muted-foreground">Prices customers propose for your products. Accept, counter with your own price, or reject.</p>
      <SellerOffers />
    </SellerShell>
  );
}
