'use client';

import Link from 'next/link';
import { AdminReviewList } from '@/components/admin/reviews/review-list';

export default function AdminReviewsPage() {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
          <p className="text-sm text-muted-foreground">Every customer review. Open one to read the thread, hide it or restore it. Admins never edit what a customer wrote.</p>
        </div>
        <Link href="/admin/reviews/reports" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Report queue</Link>
      </div>
      <AdminReviewList />
    </div>
  );
}
