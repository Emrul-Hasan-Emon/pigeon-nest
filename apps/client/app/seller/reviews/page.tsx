'use client';

import { SellerShell } from '@/components/orders/ui';
import { SellerReviews } from '@/components/reviews/seller-reviews';

export default function SellerReviewsPage() {
  return (
    <SellerShell active="reviews">
      <h1 className="mb-1 text-foreground">Customer reviews</h1>
      <p className="mb-5 text-sm text-muted-foreground">What customers wrote about your products. Reply to each one: your reply is public. You see a shortened name only, such as “Rahim K.”. Use “Share this review” to post a good review anywhere.</p>
      <SellerReviews />
    </SellerShell>
  );
}
