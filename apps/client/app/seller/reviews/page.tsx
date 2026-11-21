'use client';

import { SellerShell } from '@/components/orders/ui';
import { SellerReviews } from '@/components/reviews/seller-reviews';

export default function SellerReviewsPage() {
  return (
    <SellerShell active="reviews">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Reviews</h1>
      <p className="mb-5 text-sm text-muted-foreground">What customers wrote about your products. Answer them; the reply is public. You see a masked name only, never who they are.</p>
      <SellerReviews />
    </SellerShell>
  );
}
