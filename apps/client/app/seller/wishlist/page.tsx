'use client';

import { SellerShell } from '@/components/orders/ui';
import { SellerWishlistInsightsPanel } from '@/components/wishlist/seller-wishlist-insights';

export default function SellerWishlistPage() {
  return (
    <SellerShell active="wishlist">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Wishlist</h1>
      <p className="mb-5 text-sm text-muted-foreground">Which of your products customers saved to buy later. Use it to see what is wanted.</p>
      <SellerWishlistInsightsPanel limit={50} title="Most saved products" searchable />
    </SellerShell>
  );
}
